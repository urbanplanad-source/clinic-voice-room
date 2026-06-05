export function normalizedTextTranslationModel(value: string | undefined) {
  const trimmed = value?.trim();
  if (!trimmed || trimmed === "gpt-5.5") return "gpt-5.2";
  return trimmed;
}

export function normalizedTranscriptionModel(value: string | undefined) {
  return value?.trim() || "gpt-4o-mini-transcribe";
}
