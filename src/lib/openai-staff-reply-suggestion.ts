import {
  buildClinicGlossaryInstructions,
  type ClinicGlossaryData
} from "./clinic-glossary";
import { compareClinicalUnitSignatures } from "./clinical-unit-guard";
import { languageLabels, type PatientLanguage } from "./languages";
import { CriticalNumericTranslationError } from "./openai-text-translation";
import {
  compareNumericSignatures,
  hasCriticalNumericContext,
  numberGuardEnabled
} from "./number-guard";
import { logModelRoute, routeTranslationModel } from "./model-router";

const replySuggestionReasoningEffort = "medium";
const defaultReplySuggestionTimeoutMs = 10_000;

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

type OrderedReplyOutput = {
  suggestedReplyKo: string;
  translatedReply: string;
};

export type OpenAIStaffReplySuggestionResult = OrderedReplyOutput & {
  model: string;
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

function parseOrderedReplyOutput(data: ResponsesApiResponse): OrderedReplyOutput {
  const outputText = extractOutputText(data);
  if (!outputText) throw new Error("empty_reply_suggestion");

  let parsed: unknown;
  try {
    parsed = JSON.parse(outputText);
  } catch {
    throw new Error("invalid_reply_suggestion_output");
  }

  if (!parsed || typeof parsed !== "object") {
    throw new Error("invalid_reply_suggestion_output");
  }

  const candidate = parsed as Partial<OrderedReplyOutput>;
  const suggestedReplyKo = candidate.suggestedReplyKo?.trim();
  const translatedReply = candidate.translatedReply?.trim();
  if (!suggestedReplyKo || !translatedReply || !/[가-힣]/u.test(suggestedReplyKo)) {
    throw new Error("invalid_reply_suggestion_output");
  }

  return { suggestedReplyKo, translatedReply };
}

export function buildStaffReplySuggestionInstructions(
  sourceLanguage: PatientLanguage,
  glossaryData: ClinicGlossaryData
) {
  const targetLabel = languageLabels[sourceLanguage].english;

  return [
    "You draft one optional reply for Korean hospital staff responding to a foreign-language customer.",
    "The confirmed Korean meaning supplied by the user is authoritative. Use the original customer message only to preserve names and nuance.",
    "Perform these steps exactly in order:",
    "1. Write one concise, natural, polite staff reply in Korean in suggestedReplyKo.",
    `2. Translate the complete suggestedReplyKo from step 1 into ${targetLabel} in translatedReply.`,
    "translatedReply must be a faithful translation of suggestedReplyKo. Do not answer independently in the target language.",
    "Answer the customer's intent as hospital staff. Never continue as the customer, predict the customer's next words, or replace the confirmed Korean meaning.",
    "Do not claim that a booking is confirmed or available. Ask for the desired procedure and preferred date and time, then say availability will be checked.",
    "Do not invent or confirm prices, discounts, schedules, diagnoses, treatment suitability, outcomes, doctor decisions, consent, risks, medication instructions, or clinical advice.",
    "For symptoms, side effects, allergies, pregnancy, medication, contraindications, or urgent concerns, say that staff or the doctor needs to check. Do not make a medical judgment.",
    "Do not introduce a number, price, date, dose, frequency, product, procedure, or body area that the customer did not mention.",
    "Keep the reply to one to three short sentences. Use no emoji, markdown, labels, quotation marks, or commentary.",
    "Return only the required suggestedReplyKo and translatedReply structured fields.",
    buildClinicGlossaryInstructions(sourceLanguage, glossaryData)
  ].join("\n");
}

async function callOrderedReplySuggestion(params: {
  apiKey: string;
  safetyIdentifier: string;
  model: string;
  sourceLanguage: PatientLanguage;
  customerSourceText: string;
  customerMessageKo: string;
  instructions: string;
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
      reasoning: { effort: replySuggestionReasoningEffort },
      text: {
        verbosity: "low",
        format: {
          type: "json_schema",
          name: "staff_reply_suggestion",
          strict: true,
          schema: {
            type: "object",
            properties: {
              suggestedReplyKo: { type: "string" },
              translatedReply: { type: "string" }
            },
            required: ["suggestedReplyKo", "translatedReply"],
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
          content: [{
            type: "input_text",
            text: JSON.stringify({
              customerOriginalLanguage: languageLabels[params.sourceLanguage].english,
              customerOriginalMessage: params.customerSourceText,
              confirmedKoreanMeaning: params.customerMessageKo
            })
          }]
        }
      ]
    }),
    signal: AbortSignal.timeout(params.timeoutMs)
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    console.error("[staff-reply-suggestion]", response.status, detail);
    throw new Error("reply_suggestion_failed");
  }

  return parseOrderedReplyOutput((await response.json()) as ResponsesApiResponse);
}

function compareReplyResult(
  customerMessageKo: string,
  output: OrderedReplyOutput
) {
  const translatedNumbers = compareNumericSignatures(
    output.suggestedReplyKo,
    output.translatedReply
  );
  const translatedUnits = compareClinicalUnitSignatures(
    output.suggestedReplyKo,
    output.translatedReply
  );
  const suggestedNumbers = compareNumericSignatures(
    customerMessageKo,
    output.suggestedReplyKo
  );
  const suggestedUnits = compareClinicalUnitSignatures(
    customerMessageKo,
    output.suggestedReplyKo
  );
  const inventedCriticalDetail =
    (
      suggestedNumbers.extra.length > 0 &&
      hasCriticalNumericContext(output.suggestedReplyKo)
    ) ||
    suggestedUnits.extra.length > 0;

  return {
    ok: translatedNumbers.ok && translatedUnits.ok && !inventedCriticalDetail,
    translatedNumbers,
    translatedUnits,
    suggestedNumbers,
    suggestedUnits,
    inventedCriticalDetail
  };
}

export async function generateStaffReplySuggestionWithOpenAI(params: {
  apiKey: string;
  safetyIdentifier: string;
  sourceLanguage: PatientLanguage;
  customerSourceText: string;
  customerMessageKo: string;
  glossaryData: ClinicGlossaryData;
  timeoutMs?: number;
}): Promise<OpenAIStaffReplySuggestionResult> {
  const routed = routeTranslationModel(
    `${params.customerMessageKo}\n${params.customerSourceText}`,
    params.glossaryData
  );
  const route = {
    ...routed,
    tier: "standard" as const,
    model: routed.standardModel,
    reason: "force_standard_reply_suggestion"
  };
  logModelRoute("staff-reply-suggestion", route);

  const instructions = buildStaffReplySuggestionInstructions(
    params.sourceLanguage,
    params.glossaryData
  );
  const totalTimeoutMs = Math.max(
    500,
    params.timeoutMs ?? defaultReplySuggestionTimeoutMs
  );
  const deadlineAt = Date.now() + totalTimeoutMs;
  const remainingTimeoutMs = () => Math.max(1, deadlineAt - Date.now());

  let output = await callOrderedReplySuggestion({
    ...params,
    instructions,
    model: route.model,
    timeoutMs: remainingTimeoutMs()
  });

  if (!numberGuardEnabled()) {
    return { ...output, model: route.model };
  }

  let comparison = compareReplyResult(params.customerMessageKo, output);
  if (comparison.ok) {
    return { ...output, model: route.model };
  }

  if (remainingTimeoutMs() < 250) {
    throw new CriticalNumericTranslationError(
      "staff_reply_suggestion_retry_deadline_exceeded"
    );
  }

  const retryInstructions = [
    instructions,
    "CRITICAL: Repeat both ordered steps. Do not invent any price, amount, date, dose, frequency, or clinical unit. translatedReply must preserve every number and clinical unit from suggestedReplyKo exactly."
  ].join("\n");

  output = await callOrderedReplySuggestion({
    ...params,
    instructions: retryInstructions,
    model: route.model,
    timeoutMs: remainingTimeoutMs()
  });
  comparison = compareReplyResult(params.customerMessageKo, output);

  if (!comparison.ok) {
    console.error("[staff-reply-suggestion-guard] mismatch", JSON.stringify({
      model: route.model,
      inventedCriticalDetail: comparison.inventedCriticalDetail,
      suggestedNumericExtra: comparison.suggestedNumbers.extra,
      suggestedUnitExtra: comparison.suggestedUnits.extra,
      translationNumericMissing: comparison.translatedNumbers.missing,
      translationNumericExtra: comparison.translatedNumbers.extra,
      translationUnitMissing: comparison.translatedUnits.missing,
      translationUnitExtra: comparison.translatedUnits.extra
    }));
    throw new CriticalNumericTranslationError(
      "staff_reply_suggestion_guard_mismatch"
    );
  }

  return { ...output, model: route.model };
}
