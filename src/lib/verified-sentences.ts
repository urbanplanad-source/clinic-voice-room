import type { ClinicGlossaryData, GlossaryTargetLanguage, VerifiedSentenceEntry } from "./clinic-glossary";
import { compileGlossaryIndex } from "./compiled-glossary-index";
import { normalizeForGlossaryMatch } from "./glossary-normalization";

export type VerifiedSentenceMatch = {
  entry: VerifiedSentenceEntry;
  translatedText: string;
};

export function verifiedSentencesEnabled() {
  return process.env.VERIFIED_SENTENCES === "on";
}

export function normalizeForMatch(text: string) {
  return normalizeForGlossaryMatch(text);
}

function directTranslationFor(entry: VerifiedSentenceEntry, targetLanguage: GlossaryTargetLanguage) {
  if (targetLanguage === "ko") return entry.standardKo.trim();
  return entry.translations[targetLanguage]?.trim();
}

export function matchVerifiedSentence(text: string, targetLanguage: GlossaryTargetLanguage, glossaryData: ClinicGlossaryData): VerifiedSentenceMatch | null {
  if (!verifiedSentencesEnabled()) return null;

  const normalizedInput = normalizeForMatch(text);
  if (!normalizedInput) return null;

  const entry = compileGlossaryIndex(glossaryData).verifiedByNormalizedInput.get(normalizedInput);
  if (!entry) return null;
  const translatedText = directTranslationFor(entry, targetLanguage);
  return translatedText ? { entry, translatedText } : null;
}
