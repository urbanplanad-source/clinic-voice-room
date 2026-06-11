import type { ClinicGlossaryData, GlossaryTargetLanguage, VerifiedSentenceEntry } from "./clinic-glossary";

export type VerifiedSentenceMatch = {
  entry: VerifiedSentenceEntry;
  translatedText: string;
};

const removablePunctuationPattern = /[\s\p{P}\p{S}]+/gu;

export function verifiedSentencesEnabled() {
  return process.env.VERIFIED_SENTENCES === "on";
}

export function normalizeForMatch(text: string) {
  return text
    .normalize("NFKC")
    .toLocaleLowerCase()
    .replace(removablePunctuationPattern, "");
}

function directTranslationFor(entry: VerifiedSentenceEntry, targetLanguage: GlossaryTargetLanguage) {
  if (targetLanguage === "ko") return entry.standardKo.trim();
  return entry.translations[targetLanguage]?.trim();
}

export function matchVerifiedSentence(text: string, targetLanguage: GlossaryTargetLanguage, glossaryData: ClinicGlossaryData): VerifiedSentenceMatch | null {
  if (!verifiedSentencesEnabled()) return null;

  const normalizedInput = normalizeForMatch(text);
  if (!normalizedInput) return null;

  for (const entry of glossaryData.verifiedSentences) {
    const translatedText = directTranslationFor(entry, targetLanguage);
    if (!translatedText) continue;

    const candidates = [entry.standardKo, ...entry.spoken];
    for (const candidate of candidates) {
      if (normalizeForMatch(candidate) === normalizedInput) {
        return { entry, translatedText };
      }
    }
  }

  return null;
}
