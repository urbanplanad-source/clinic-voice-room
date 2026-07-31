import type { ClinicGlossaryData } from "./clinic-glossary";
import { compareClinicalUnitSignatures } from "./clinical-unit-guard";
import type { GuardFlags } from "./guard-flags";
import { CriticalNumericTranslationError } from "./openai-text-translation";
import {
  compareNumericSignatures,
  hasCriticalNumericContext,
  numberGuardEnabled
} from "./number-guard";
import { logModelRoute, routeTranslationModel } from "./model-router";

const textTranslationReasoningEffort = "medium";
const defaultTranslationTimeoutMs = 12_000;

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

type OrderedModelOutput = {
  polishedKorean: string;
  translatedText: string;
};

export type OpenAIKoreanPolishTranslationResult = {
  polishedSourceText: string;
  translatedText: string;
  model: string;
  guardFlags?: GuardFlags;
};

function extractOutputText(data: ResponsesApiResponse) {
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

function parseOrderedModelOutput(data: ResponsesApiResponse): OrderedModelOutput {
  const outputText = extractOutputText(data);
  if (!outputText) throw new Error("empty_translation");

  let parsed: unknown;
  try {
    parsed = JSON.parse(outputText);
  } catch {
    throw new Error("invalid_ordered_translation_output");
  }

  if (!parsed || typeof parsed !== "object") {
    throw new Error("invalid_ordered_translation_output");
  }

  const candidate = parsed as Partial<OrderedModelOutput>;
  const polishedKorean = candidate.polishedKorean?.trim();
  const translatedText = candidate.translatedText?.trim();
  if (!polishedKorean || !translatedText) {
    throw new Error("invalid_ordered_translation_output");
  }

  return { polishedKorean, translatedText };
}

async function callOrderedTranslation(params: {
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
      text: {
        verbosity: "low",
        format: {
          type: "json_schema",
          name: "ordered_korean_translation",
          strict: true,
          schema: {
            type: "object",
            properties: {
              polishedKorean: { type: "string" },
              translatedText: { type: "string" }
            },
            required: ["polishedKorean", "translatedText"],
            additionalProperties: false
          }
        }
      },
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

  return parseOrderedModelOutput((await response.json()) as ResponsesApiResponse);
}

function compareOrderedResult(sourceText: string, output: OrderedModelOutput) {
  const polishNumbers = compareNumericSignatures(sourceText, output.polishedKorean);
  const translationNumbers = compareNumericSignatures(output.polishedKorean, output.translatedText);
  const polishUnits = compareClinicalUnitSignatures(sourceText, output.polishedKorean);
  const translationUnits = compareClinicalUnitSignatures(output.polishedKorean, output.translatedText);
  const ok = polishNumbers.ok && translationNumbers.ok && polishUnits.ok && translationUnits.ok;
  const critical =
    hasCriticalNumericContext(sourceText) ||
    hasCriticalNumericContext(output.polishedKorean) ||
    hasCriticalNumericContext(output.translatedText) ||
    polishUnits.sourceUnits.length > 0 ||
    polishUnits.translatedUnits.length > 0 ||
    translationUnits.translatedUnits.length > 0;

  return {
    ok,
    critical,
    polishNumbers,
    translationNumbers,
    polishUnits,
    translationUnits
  };
}

function guardFlagsFor(sourceText: string, translatedText: string): GuardFlags | undefined {
  const comparison = compareNumericSignatures(sourceText, translatedText);
  if (comparison.ok) return undefined;

  return {
    numberCheck: "mismatch",
    sourceNumbers: comparison.sourceNumbers,
    translatedNumbers: comparison.translatedNumbers
  };
}

export async function polishKoreanAndTranslateWithOpenAITextSafety(params: {
  apiKey: string;
  safetyIdentifier: string;
  sourceText: string;
  instructions: string;
  glossaryData: ClinicGlossaryData;
  errorLabel: string;
  context: string;
  forceStandard?: boolean;
  timeoutMs?: number;
}): Promise<OpenAIKoreanPolishTranslationResult> {
  const routed = routeTranslationModel(params.sourceText, params.glossaryData);
  const route = params.forceStandard
    ? { ...routed, tier: "standard" as const, model: routed.standardModel, reason: "force_standard" }
    : routed;
  logModelRoute(params.context, route);

  const totalTimeoutMs = Math.max(500, params.timeoutMs ?? defaultTranslationTimeoutMs);
  const deadlineAt = Date.now() + totalTimeoutMs;
  const remainingTimeoutMs = () => Math.max(1, deadlineAt - Date.now());

  let model = route.model;
  let output = await callOrderedTranslation({
    ...params,
    model,
    timeoutMs: remainingTimeoutMs()
  });

  if (!numberGuardEnabled()) {
    return {
      polishedSourceText: output.polishedKorean,
      translatedText: output.translatedText,
      model
    };
  }

  let comparison = compareOrderedResult(params.sourceText, output);
  if (comparison.ok) {
    return {
      polishedSourceText: output.polishedKorean,
      translatedText: output.translatedText,
      model,
      guardFlags: guardFlagsFor(params.sourceText, output.translatedText)
    };
  }

  const retryModel = route.tier === "light" ? route.standardModel : model;
  const retryInstructions = [
    params.instructions,
    "CRITICAL: Repeat both ordered steps. polishedKorean must preserve every number, price, date, unit, procedure name, medication name, and body area from the raw Korean without adding anything. translatedText must translate exactly polishedKorean and preserve the same details."
  ].join("\n");

  try {
    if (remainingTimeoutMs() < 250) {
      throw new Error("translation_retry_deadline_exceeded");
    }
    output = await callOrderedTranslation({
      ...params,
      model: retryModel,
      instructions: retryInstructions,
      timeoutMs: remainingTimeoutMs()
    });
    model = retryModel;
    comparison = compareOrderedResult(params.sourceText, output);
  } catch (caught) {
    if (comparison.critical) {
      console.error("[ordered-translation-guard] critical retry failed", caught);
      throw new CriticalNumericTranslationError("critical_translation_retry_failed");
    }
    console.error("[ordered-translation-guard] retry fail-open", caught);
    return {
      polishedSourceText: output.polishedKorean,
      translatedText: output.translatedText,
      model,
      guardFlags: guardFlagsFor(params.sourceText, output.translatedText)
    };
  }

  if (comparison.ok) {
    return {
      polishedSourceText: output.polishedKorean,
      translatedText: output.translatedText,
      model,
      guardFlags: guardFlagsFor(params.sourceText, output.translatedText)
    };
  }

  if (comparison.critical) {
    console.error("[ordered-translation-guard] critical mismatch", JSON.stringify({
      context: params.context,
      model,
      polishNumeric: {
        missing: comparison.polishNumbers.missing,
        extra: comparison.polishNumbers.extra
      },
      translationNumeric: {
        missing: comparison.translationNumbers.missing,
        extra: comparison.translationNumbers.extra
      },
      polishUnits: {
        missing: comparison.polishUnits.missing,
        extra: comparison.polishUnits.extra,
        sourcePairs: comparison.polishUnits.sourcePairs,
        translatedPairs: comparison.polishUnits.translatedPairs
      },
      translationUnits: {
        missing: comparison.translationUnits.missing,
        extra: comparison.translationUnits.extra,
        sourcePairs: comparison.translationUnits.sourcePairs,
        translatedPairs: comparison.translationUnits.translatedPairs
      }
    }));
    throw new CriticalNumericTranslationError("critical_translation_guard_mismatch");
  }

  return {
    polishedSourceText: output.polishedKorean,
    translatedText: output.translatedText,
    model,
    guardFlags: guardFlagsFor(params.sourceText, output.translatedText)
  };
}
