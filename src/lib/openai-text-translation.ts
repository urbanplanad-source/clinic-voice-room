import type { ClinicGlossaryData } from "./clinic-glossary";
import { compareClinicalUnitSignatures } from "./clinical-unit-guard";
import type { GuardFlags } from "./guard-flags";
import {
  compareNumericSignatures,
  hasCriticalNumericContext,
  numberGuardEnabled
} from "./number-guard";
import { logModelRoute, routeTranslationModel } from "./model-router";

const textTranslationReasoningEffort = "medium";
const defaultTranslationTimeoutMs = 8_000;

type ResponsesApiContent = {
  type?: string;
  text?: string;
};

type ResponsesApiOutputItem = {
  type?: string;
  content?: ResponsesApiContent[];
};

type ResponsesApiResponse = {
  output_text?: string;
  output?: ResponsesApiOutputItem[];
};

export type OpenAITextTranslationResult = {
  translatedText: string;
  model: string;
  guardFlags?: GuardFlags;
};

export class CriticalNumericTranslationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CriticalNumericTranslationError";
  }
}

export function extractResponsesOutputText(data: ResponsesApiResponse) {
  if (typeof data.output_text === "string") return data.output_text.trim();

  return (
    data.output
      ?.flatMap((item) => item.content ?? [])
      .map((content) => content.text)
      .filter((text): text is string => typeof text === "string")
      .join("")
      .trim() ?? ""
  );
}

async function callResponsesTranslation(params: {
  apiKey: string;
  safetyIdentifier: string;
  model: string;
  instructions: string;
  sourceText: string;
  errorLabel: string;
  timeoutMs: number;
}) {
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${params.apiKey}`,
      "Content-Type": "application/json",
      "OpenAI-Safety-Identifier": params.safetyIdentifier
    },
    body: JSON.stringify({
      model: params.model,
      reasoning: { effort: textTranslationReasoningEffort },
      text: { verbosity: "low" },
      input: [
        {
          role: "system",
          content: [{ type: "input_text", text: params.instructions }]
        },
        {
          role: "user",
          content: [{ type: "input_text", text: params.sourceText }]
        }
      ]
    }),
    signal: AbortSignal.timeout(params.timeoutMs)
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    console.error(params.errorLabel, response.status, detail);
    throw new Error("translation_failed");
  }

  const data = (await response.json()) as ResponsesApiResponse;
  const translatedText = extractResponsesOutputText(data);
  if (!translatedText) throw new Error("empty_translation");
  return translatedText;
}

export async function translateWithOpenAITextSafety(params: {
  apiKey: string;
  safetyIdentifier: string;
  sourceText: string;
  instructions: string;
  glossaryData: ClinicGlossaryData;
  errorLabel: string;
  context: string;
  forceStandard?: boolean;
  timeoutMs?: number;
}): Promise<OpenAITextTranslationResult> {
  const routed = routeTranslationModel(params.sourceText, params.glossaryData);
  const route = params.forceStandard
    ? { ...routed, tier: "standard" as const, model: routed.standardModel, reason: "force_standard" }
    : routed;
  logModelRoute(params.context, route);

  const totalTimeoutMs = Math.max(500, params.timeoutMs ?? defaultTranslationTimeoutMs);
  const deadlineAt = Date.now() + totalTimeoutMs;
  const remainingTimeoutMs = () => Math.max(1, deadlineAt - Date.now());

  let model = route.model;
  let translatedText = await callResponsesTranslation({
    ...params,
    model,
    timeoutMs: remainingTimeoutMs()
  });

  if (!numberGuardEnabled()) return { translatedText, model };

  const numericComparison = compareNumericSignatures(params.sourceText, translatedText);
  const unitComparison = compareClinicalUnitSignatures(params.sourceText, translatedText);
  if (numericComparison.ok && unitComparison.ok) return { translatedText, model };

  const criticalContext = hasCriticalNumericContext(params.sourceText) ||
    hasCriticalNumericContext(translatedText) ||
    unitComparison.sourceUnits.length > 0 ||
    unitComparison.translatedUnits.length > 0;
  const retryModel = route.tier === "light" ? route.standardModel : model;
  const numericRequirement = numericComparison.ok
    ? null
    : numericComparison.sourceNumbers.length > 0
      ? `Preserve exactly these numeric values: ${numericComparison.sourceNumbers.join(", ")}.`
      : "Do not introduce any numeric values; the source contains none.";
  const unitRequirement = unitComparison.ok
    ? null
    : unitComparison.sourceUnits.length > 0
      ? [
          `Preserve these clinical unit categories exactly: ${unitComparison.sourceUnits.join(", ")}.`,
          unitComparison.pairMismatch
            ? `Preserve these number-to-unit pairs exactly: ${unitComparison.sourcePairs.join(", ")}.`
            : "",
          "Volume units cc and mL are equivalent, but never replace volume, mass, length, shot, ampoule, percent, or IU units with another category."
        ].filter(Boolean).join(" ")
      : "Do not introduce any clinical measurement units; the source contains none.";
  const retryRequirements = [
    numericRequirement,
    unitRequirement
  ].filter((requirement): requirement is string => Boolean(requirement));
  const retryInstruction = [
    params.instructions,
    `CRITICAL: ${retryRequirements.join(" ")} Re-translate precisely.`
  ].join("\n");

  let retryText: string;
  try {
    if (remainingTimeoutMs() < 250) {
      throw new Error("translation_retry_deadline_exceeded");
    }
    retryText = await callResponsesTranslation({
      ...params,
      model: retryModel,
      instructions: retryInstruction,
      timeoutMs: remainingTimeoutMs()
    });
  } catch (caught) {
    if (criticalContext) {
      console.error("[translation-guard] critical retry failed", caught);
      throw new CriticalNumericTranslationError("critical_translation_retry_failed");
    }
    console.error("[number-guard] retry fail-open", caught);
    return { translatedText, model };
  }

  const retryNumericComparison = compareNumericSignatures(params.sourceText, retryText);
  const retryUnitComparison = compareClinicalUnitSignatures(params.sourceText, retryText);
  model = retryModel;
  translatedText = retryText;
  if (retryNumericComparison.ok && retryUnitComparison.ok) {
    return { translatedText, model };
  }

  const retryCriticalContext = criticalContext ||
    hasCriticalNumericContext(retryText) ||
    retryUnitComparison.translatedUnits.length > 0;

  if (retryCriticalContext) {
    throw new CriticalNumericTranslationError("critical_translation_guard_mismatch");
  }

  return {
    translatedText,
    model,
    guardFlags: {
      numberCheck: "mismatch",
      sourceNumbers: retryNumericComparison.sourceNumbers,
      translatedNumbers: retryNumericComparison.translatedNumbers
    }
  };
}
