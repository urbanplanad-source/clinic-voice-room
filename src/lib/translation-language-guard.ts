const hangulPattern = /[\u1100-\u11ff\u3130-\u318f\uac00-\ud7af]/g;
const kanaPattern = /[\u3040-\u30ff\u31f0-\u31ff]/g;
const hanPattern = /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/g;
const thaiPattern = /[\u0e00-\u0e7f]/g;
const cyrillicPattern = /[\u0400-\u052f]/g;
const mongolianPattern = /[\u1800-\u18af]/g;
const arabicPattern = /[\u0600-\u06ff]/g;
const latinLetterPattern = /[A-Za-z\u00c0-\u024f]/g;
const latinWordPattern = /[A-Za-z\u00c0-\u024f]+(?:['’-][A-Za-z\u00c0-\u024f]+)*/g;

const acceptedLatinClinicTokens = new Set([
  "belotero",
  "botox",
  "cc",
  "flx",
  "hda",
  "hifu",
  "iu",
  "juvelook",
  "ldm",
  "ml",
  "pico",
  "potenza",
  "prp",
  "re2o",
  "rejuran",
  "restylane",
  "sculptra",
  "skinvive",
  "thermage",
  "ultherapy",
  "xerf"
]);

const shortForeignReplyPattern = /^(?:yes|no|ok(?:ay)?|sure|thanks?|thank\s+you|hello|hi|bye)[.!?]*$/i;

function countMatches(value: string, pattern: RegExp) {
  return value.match(pattern)?.length ?? 0;
}

function isAcceptedLatinClinicPhrase(value: string) {
  const words = value.toLowerCase().match(/[a-z0-9]+/g) ?? [];
  return words.length > 0 && words.every((word) => /^\d+$/.test(word) || acceptedLatinClinicTokens.has(word));
}

/**
 * Detects only high-confidence cases where a Korean-target translation is still
 * written in the source language. False negatives are preferable to replacing a
 * valid brand-only translation.
 */
export function isClearlyNotKoreanTranslation(sourceText: string, translatedText: string) {
  const translated = translatedText.trim();
  if (!translated) return false;

  const hangulCount = countMatches(translated, hangulPattern);
  const foreignScriptCount =
    countMatches(translated, kanaPattern) +
    countMatches(translated, hanPattern) +
    countMatches(translated, thaiPattern) +
    countMatches(translated, cyrillicPattern) +
    countMatches(translated, mongolianPattern) +
    countMatches(translated, arabicPattern);
  const latinLetters = countMatches(translated, latinLetterPattern);
  const latinWords = translated.match(latinWordPattern) ?? [];

  if (hangulCount > 0) {
    return foreignScriptCount >= Math.max(3, hangulCount * 2) ||
      (latinLetters >= Math.max(12, hangulCount * 4) && latinWords.length >= 3);
  }

  if (foreignScriptCount >= 1) return true;

  if (latinLetters === 0 || isAcceptedLatinClinicPhrase(translated)) return false;
  if (shortForeignReplyPattern.test(translated)) return true;

  if (latinLetters >= 8 && latinWords.length >= 2) return true;

  const normalizedSource = sourceText.toLowerCase().replace(/[^a-z0-9]+/g, "");
  const normalizedTranslation = translated.toLowerCase().replace(/[^a-z0-9]+/g, "");
  return latinLetters >= 5 &&
    normalizedSource.length > 0 &&
    normalizedSource === normalizedTranslation &&
    !isAcceptedLatinClinicPhrase(sourceText);
}
