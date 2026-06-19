import type { ClinicGlossaryData } from "./clinic-glossary";
import type { GuardFlags } from "./guard-flags";
import { compareNumericSignatures, numberGuardEnabled } from "./number-guard";
import { logModelRoute, routeTranslationModel } from "./model-router";

const textTranslationReasoningEffort = "medium";

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
    })
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
}): Promise<OpenAITextTranslationResult> {
  const routed = routeTranslationModel(params.sourceText, params.glossaryData);
  const route = params.forceStandard
    ? { ...routed, tier: "standard" as const, model: routed.standardModel, reason: "force_standard" }
    : routed;
  logModelRoute(params.context, route);

  let model = route.model;
  let translatedText = await callResponsesTranslation({ ...params, model });

  if (!numberGuardEnabled()) return { translatedText, model };

  try {
    const comparison = compareNumericSignatures(params.sourceText, translatedText);
    if (comparison.ok) return { translatedText, model };

    const retryModel = route.tier === "light" ? route.standardModel : model;
    const retryInstruction = [
      params.instructions,
      `CRITICAL: The translation must contain exactly these numeric values: ${comparison.sourceNumbers.join(", ")}. Re-translate precisely.`
    ].join("\n");
    const retryText = await callResponsesTranslation({
      ...params,
      model: retryModel,
      instructions: retryInstruction
    });
    const retryComparison = compareNumericSignatures(params.sourceText, retryText);
    model = retryModel;
    translatedText = retryText;
    if (retryComparison.ok) return { translatedText, model };

    return {
      translatedText,
      model,
      guardFlags: {
        numberCheck: "mismatch",
        sourceNumbers: retryComparison.sourceNumbers,
        translatedNumbers: retryComparison.translatedNumbers
      }
    };
  } catch (caught) {
    console.error("[number-guard] fail-open", caught);
    return { translatedText, model };
  }
}
