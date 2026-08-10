const removablePunctuationPattern = /[\s\p{P}\p{S}]+/gu;

export function normalizeForGlossaryMatch(text: string) {
  return text
    .normalize("NFKC")
    .toLocaleLowerCase()
    .replace(removablePunctuationPattern, "");
}
