export type LocalTranslationValidationResult = {
  ok: boolean;
  reason: string;
  correctedTranslation: string;
};

export function buildLocalTranslationValidationInstructions(params: {
  sourceLanguage: string;
  targetLanguage: string;
  glossaryInstructions?: string;
}) {
  return [
    "You validate and, when necessary, repair a short medical interpreter turn.",
    "Decide whether the candidate translation faithfully preserves the source meaning.",
    `Expected source language: ${params.sourceLanguage}.`,
    `Expected target language: ${params.targetLanguage}.`,
    "Preserve the speech act exactly: questions must remain questions, requests must remain requests, and statements must remain statements.",
    "Never answer the source speaker, predict the other participant's response, or continue the conversation.",
    "A fluent, plausible clinic sentence is still wrong when it does not express the same action, body part, intent, subject, or polarity as the source.",
    'Example: Japanese source "目を開けてください。" with Korean candidate "시작할게요." must be ok=false and corrected to "눈을 떠 주세요.".',
    "Accept minor punctuation, politeness, and natural phrasing differences.",
    "Set ok=false if the language is wrong, the meaning changed, content was added or omitted, or the source and candidate do not correspond.",
    'When ok=true, correctedTranslation must be an empty string.',
    "When ok=false, correctedTranslation must contain only a faithful translation in the expected target language, with no label, quote, explanation, or reply.",
    params.glossaryInstructions ?? ""
  ]
    .filter(Boolean)
    .join("\n");
}

export function parseLocalTranslationValidationResult(value: string): LocalTranslationValidationResult | null {
  const objectText = value.match(/\{[\s\S]*\}/)?.[0] ?? "";
  if (!objectText) return null;

  try {
    const parsed = JSON.parse(objectText) as {
      ok?: unknown;
      reason?: unknown;
      correctedTranslation?: unknown;
    };
    if (typeof parsed.ok !== "boolean") return null;
    return {
      ok: parsed.ok,
      reason: typeof parsed.reason === "string" ? parsed.reason.slice(0, 160) : "",
      correctedTranslation: typeof parsed.correctedTranslation === "string" ? parsed.correctedTranslation.trim() : ""
    };
  } catch {
    return null;
  }
}

export function resolveLocalTranslation(
  originalTranslation: string,
  validation: LocalTranslationValidationResult
) {
  const original = originalTranslation.trim();
  const corrected = validation.ok ? "" : validation.correctedTranslation.trim();
  const repaired = !validation.ok && Boolean(corrected) && corrected !== original;
  return {
    translatedText: repaired ? corrected : original,
    repaired
  };
}
