import type { ClinicGlossaryData, GlossaryTargetLanguage } from "./clinic-glossary";
import { normalizeClinicTranslation } from "./clinic-glossary";
import { matchVerifiedSentence } from "./verified-sentences";

export function resolveRealtimeVerifiedTranslation(params: {
  sourceText: string;
  sourceTranscriptComplete: boolean;
  targetLanguage: GlossaryTargetLanguage;
  glossaryData: ClinicGlossaryData;
}) {
  if (!params.sourceTranscriptComplete) return null;
  const match = matchVerifiedSentence(params.sourceText, params.targetLanguage, params.glossaryData);
  if (!match) return null;
  return {
    translatedText: normalizeClinicTranslation(match.translatedText, params.targetLanguage, params.glossaryData),
    model: "verified",
    translationSource: "verified" as const,
    entry: match.entry
  };
}
