import { compareClinicalUnitSignatures } from "./clinical-unit-guard";
import { compareNumericSignatures } from "./number-guard";

export type SttEvaluationCase = {
  id: string;
  expectedText: string;
  requiredTerms: Array<string | string[]>;
  riskTags: string[];
};

function normalized(value: string) {
  return value.normalize("NFKC").toLocaleLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
}

function editDistance(left: string, right: string) {
  const leftCharacters = Array.from(left);
  const rightCharacters = Array.from(right);
  const previous = Array.from({ length: rightCharacters.length + 1 }, (_, index) => index);
  for (let leftIndex = 1; leftIndex <= leftCharacters.length; leftIndex += 1) {
    const current = [leftIndex];
    for (let rightIndex = 1; rightIndex <= rightCharacters.length; rightIndex += 1) {
      current[rightIndex] = Math.min(
        current[rightIndex - 1] + 1,
        previous[rightIndex] + 1,
        previous[rightIndex - 1] + (leftCharacters[leftIndex - 1] === rightCharacters[rightIndex - 1] ? 0 : 1)
      );
    }
    previous.splice(0, previous.length, ...current);
  }
  return previous[rightCharacters.length];
}

const chineseDigitValues: Record<string, number> = {
  零: 0, 〇: 0, 一: 1, 二: 2, 兩: 2, 两: 2, 三: 3, 四: 4,
  五: 5, 六: 6, 七: 7, 八: 8, 九: 9
};

function chineseNumeralValue(token: string): number {
  if (!/[十百千萬万]/u.test(token)) {
    return Number(Array.from(token).map((character) => chineseDigitValues[character]).join(""));
  }
  const myriadIndex = Math.max(token.indexOf("萬"), token.indexOf("万"));
  if (myriadIndex >= 0) {
    const high = token.slice(0, myriadIndex);
    const low = token.slice(myriadIndex + 1);
    return (high ? chineseNumeralValue(high) : 1) * 10_000 + (low ? chineseNumeralValue(low) : 0);
  }
  const units: Record<string, number> = { 千: 1_000, 百: 100, 十: 10 };
  let total = 0;
  let pendingDigit: number | null = null;
  for (const character of token) {
    if (character in chineseDigitValues) {
      pendingDigit = chineseDigitValues[character];
      continue;
    }
    const unit = units[character];
    if (unit) {
      total += (pendingDigit ?? 1) * unit;
      pendingDigit = null;
    }
  }
  return total + (pendingDigit ?? 0);
}

function numericValues(value: string) {
  return Array.from(value.matchAll(/\d+(?:\.\d+)?|[零〇一二兩两三四五六七八九十百千萬万]+/gu))
    .map((match) => /^\d/u.test(match[0]) ? Number(match[0]) : chineseNumeralValue(match[0]))
    .filter(Number.isFinite)
    .sort((left, right) => left - right);
}

function equivalentNumericMultiset(expected: string, actual: string) {
  const expectedValues = numericValues(expected);
  const actualValues = numericValues(actual);
  return expectedValues.length === actualValues.length
    && expectedValues.every((value, index) => value === actualValues[index]);
}

function equivalentCjkShotUnits(expected: string, actual: string, numericEquivalent: boolean) {
  const shotPattern = /(?:\d+(?:\.\d+)?|[零〇一二兩两三四五六七八九十百千萬万]+)\s*[发發]/gu;
  return numericEquivalent
    && Array.from(expected.matchAll(shotPattern)).length > 0
    && Array.from(expected.matchAll(shotPattern)).length === Array.from(actual.matchAll(shotPattern)).length;
}

export function scoreSttTranscript(testCase: SttEvaluationCase, transcript: string) {
  const expected = normalized(testCase.expectedText);
  const actual = normalized(transcript);
  const missingTerms = testCase.requiredTerms
    .filter((term) => {
      const alternatives = Array.isArray(term) ? term : [term];
      return !alternatives.some((alternative) => actual.includes(normalized(alternative)));
    })
    .map((term) => Array.isArray(term) ? term.join(" / ") : term);
  const numberPreserved = compareNumericSignatures(testCase.expectedText, transcript).ok
    || equivalentNumericMultiset(testCase.expectedText, transcript);
  const clinicalUnitPreserved = compareClinicalUnitSignatures(testCase.expectedText, transcript).ok
    || equivalentCjkShotUnits(testCase.expectedText, transcript, numberPreserved);
  return {
    exactNormalized: expected === actual,
    characterErrorRate: Array.from(expected).length === 0
      ? (Array.from(actual).length === 0 ? 0 : 1)
      : editDistance(expected, actual) / Array.from(expected).length,
    requiredTermRecall: testCase.requiredTerms.length === 0
      ? 1
      : (testCase.requiredTerms.length - missingTerms.length) / testCase.requiredTerms.length,
    missingTerms,
    numberPreserved,
    clinicalUnitPreserved
  };
}

export function summarizeSttScores(rows: Array<ReturnType<typeof scoreSttTranscript>>) {
  const count = rows.length;
  return {
    count,
    exactRate: count ? rows.filter((row) => row.exactNormalized).length / count : 0,
    meanCharacterErrorRate: count ? rows.reduce((sum, row) => sum + row.characterErrorRate, 0) / count : 0,
    meanRequiredTermRecall: count ? rows.reduce((sum, row) => sum + row.requiredTermRecall, 0) / count : 0,
    numberPreservationRate: count ? rows.filter((row) => row.numberPreserved).length / count : 0,
    clinicalUnitPreservationRate: count ? rows.filter((row) => row.clinicalUnitPreserved).length / count : 0,
    safetyPassRate: count ? rows.filter((row) =>
      row.requiredTermRecall === 1 && row.numberPreserved && row.clinicalUnitPreserved
    ).length / count : 0
  };
}
