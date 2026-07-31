export type NumericComparison = {
  ok: boolean;
  missing: number[];
  extra: number[];
  sourceNumbers: number[];
  translatedNumbers: number[];
};

const koreanNativeNumbers: Record<string, number> = {
  하나: 1,
  한: 1,
  둘: 2,
  두: 2,
  셋: 3,
  세: 3,
  넷: 4,
  네: 4,
  다섯: 5,
  여섯: 6,
  일곱: 7,
  여덟: 8,
  아홉: 9,
  열: 10
};

const koreanSinoDigits: Record<string, number> = {
  영: 0,
  공: 0,
  일: 1,
  이: 2,
  삼: 3,
  사: 4,
  오: 5,
  육: 6,
  륙: 6,
  칠: 7,
  팔: 8,
  구: 9
};

const cjkDigits: Record<string, number> = {
  零: 0,
  〇: 0,
  一: 1,
  二: 2,
  两: 2,
  兩: 2,
  三: 3,
  四: 4,
  五: 5,
  六: 6,
  七: 7,
  八: 8,
  九: 9
};

const koreanUnits: Record<string, number> = { 십: 10, 백: 100, 천: 1000, 만: 10000 };
const cjkUnits: Record<string, number> = { 十: 10, 百: 100, 千: 1000, 万: 10000, 萬: 10000 };
const englishNumbers: Record<string, number> = {
  one: 1,
  once: 1,
  two: 2,
  twice: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10
};

function canonicalizeDigits(text: string) {
  return Array.from(text.normalize("NFKC")).map((char) => {
    const code = char.charCodeAt(0);
    if (code >= 0x0e50 && code <= 0x0e59) return String(code - 0x0e50);
    return char;
  }).join("");
}

function parseUnitNumber(text: string, digits: Record<string, number>, units: Record<string, number>) {
  if (text === "만" || text === "万" || text === "萬") return null;

  let total = 0;
  let current = 0;
  let hasUnit = false;
  let hasDigit = false;

  for (const char of Array.from(text)) {
    if (char in digits) {
      current = digits[char];
      hasDigit = true;
      continue;
    }

    const unit = units[char];
    if (unit) {
      hasUnit = true;
      total += (current || 1) * unit;
      current = 0;
    }
  }

  if (!hasDigit && !hasUnit) return null;
  return hasUnit ? total + current : current;
}

function pushNumber(numbers: number[], value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) return;
  numbers.push(Number(value.toFixed(4)));
}

function countValues(values: number[]) {
  const counts = new Map<number, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return counts;
}

function diffCounts(left: Map<number, number>, right: Map<number, number>) {
  const diff: number[] = [];
  for (const [value, count] of left) {
    const otherCount = right.get(value) ?? 0;
    for (let index = 0; index < count - otherCount; index += 1) diff.push(value);
  }
  return diff;
}

export function extractNumericSignature(text: string) {
  const normalized = canonicalizeDigits(text);
  const numbers: number[] = [];
  const scaledMoneyRanges: Array<{ start: number; end: number }> = [];

  const tenThousandMoneyPattern =
    /(?<![A-Za-z])([-+]?\d+(?:,\d{3})*(?:\.\d+)?)\s*(?:만|万|萬)\s*(?=(?:원|ウォン|韓元|韩元|圓|圆|won|krw))/giu;
  for (const match of normalized.matchAll(tenThousandMoneyPattern)) {
    const start = match.index ?? 0;
    scaledMoneyRanges.push({ start, end: start + match[0].length });
    pushNumber(numbers, Number(match[1].replace(/,/g, "")) * 10_000);
  }

  const arabicPattern = /(?<![A-Za-z])[-+]?\d+(?:,\d{3})*(?:\.\d+)?/g;
  for (const match of normalized.matchAll(arabicPattern)) {
    const start = match.index ?? 0;
    const end = start + match[0].length;
    if (scaledMoneyRanges.some((range) => start < range.end && end > range.start)) continue;
    pushNumber(numbers, Number(match[0].replace(/,/g, "")));
  }

  const koreanDayPattern = /(하루|이틀|사흘)\s*(?:동안|간|후|뒤|이내|전|만|째)/g;
  for (const match of normalized.matchAll(koreanDayPattern)) {
    const value = match[1] === "하루" ? 1 : match[1] === "이틀" ? 2 : 3;
    pushNumber(numbers, value);
  }

  const koreanHalfPattern = /반\s*(?:번|회|일|주|주일|개월|달|시간|분|개|명|병|정|알)/g;
  for (const match of normalized.matchAll(koreanHalfPattern)) {
    if (match[0]) pushNumber(numbers, 0.5);
  }

  const englishPattern = /\b(one|once|two|twice|three|four|five|six|seven|eight|nine|ten)\b/gi;
  for (const match of normalized.matchAll(englishPattern)) {
    pushNumber(numbers, englishNumbers[match[1].toLocaleLowerCase()]);
  }

  const nativePattern = /(하나|다섯|여섯|일곱|여덟|아홉|둘|셋|넷|열|한|두|세|네)\s*(?:번|회|일|주|주일|개월|달|시간|분|개|명|병|정|알)(?=$|[^가-힣]|(?:입니다|이에요|예요|이었다|이었|부터|까지|정도|가량|씩|마다|동안|간|후|전|째|으로|에서|에게|을|를|은|는|이|가|에|도|만))/g;
  for (const match of normalized.matchAll(nativePattern)) {
    pushNumber(numbers, koreanNativeNumbers[match[1]]);
  }

  const koreanSinoWithUnitPattern = /([영공일이삼사오육륙칠팔구십백천만]+)\s*(?:번|회|일|주|주일|개월|달|시간|분|개|명|병|정|알|퍼센트|프로|원|만원)(?=$|[^가-힣]|(?:입니다|이에요|예요|이었다|이었|부터|까지|정도|가량|씩|마다|동안|간|후|전|째|으로|에서|에게|을|를|은|는|이|가|에|도|만))/g;
  for (const match of normalized.matchAll(koreanSinoWithUnitPattern)) {
    pushNumber(numbers, parseUnitNumber(match[1], koreanSinoDigits, koreanUnits));
  }

  const koreanSinoStandalonePattern = /(?<![가-힣])[영공일이삼사오육륙칠팔구]*[십백천만][영공일이삼사오육륙칠팔구십백천만]*(?![가-힣])(?!\s*(?:번|회|일|주|주일|개월|달|시간|분|개|명|병|정|알|퍼센트|프로|원|만원))/g;
  for (const match of normalized.matchAll(koreanSinoStandalonePattern)) {
    pushNumber(numbers, parseUnitNumber(match[0], koreanSinoDigits, koreanUnits));
  }

  const cjkWithUnitPattern = /([零〇一二两兩三四五六七八九十百千万萬]+)\s*(?:周|週|天|日|次|回|个月|個月|月|小时|小時|分|元|岁|歲|%|％)/g;
  for (const match of normalized.matchAll(cjkWithUnitPattern)) {
    pushNumber(numbers, parseUnitNumber(match[1], cjkDigits, cjkUnits));
  }

  const cjkStandalonePattern = /[零〇一二两兩三四五六七八九]*[十百千万萬][零〇一二两兩三四五六七八九十百千万萬]*(?!\s*(?:周|週|天|日|次|回|个月|個月|月|小时|小時|分|元|岁|歲|%|％))/g;
  for (const match of normalized.matchAll(cjkStandalonePattern)) {
    pushNumber(numbers, parseUnitNumber(match[0], cjkDigits, cjkUnits));
  }

  return numbers;
}

export function compareNumericSignatures(source: string, translated: string): NumericComparison {
  const sourceNumbers = extractNumericSignature(source);
  const translatedNumbers = extractNumericSignature(translated);

  const sourceCounts = countValues(sourceNumbers);
  const translatedCounts = countValues(translatedNumbers);
  const missing = diffCounts(sourceCounts, translatedCounts);
  const extra = diffCounts(translatedCounts, sourceCounts);
  return {
    ok: missing.length === 0 && extra.length === 0,
    missing,
    extra,
    sourceNumbers,
    translatedNumbers
  };
}

const criticalMoneyContextPattern =
  /(?:[\u20A9\u00A5\u0024\uFFE6\uFFE5]|\u5186|\u5143|\b(?:won|krw|yen|jpy|yuan|cny|rmb|dollars?|usd|euros?|eur)\b)/iu;

const koreanMoneyContextPattern =
  /(?:[-+]?\d+(?:,\d{3})*(?:\.\d+)?|[영공일이삼사오육륙칠팔구십백천만]+)\s*(?:만\s*)?원(?=$|[^가-힣]|(?:입니다|이에요|예요|이었다|이었|부터|까지|정도|가량|대로|대|씩|짜리|으로|을|를|은|는|이|가))/u;

const criticalClinicalUnitContextPattern =
  /(?:(?<![A-Za-z])(?:cc|ml|mg|g|kg|mm|cm|iu)(?![A-Za-z])|%|\uC0F7|\uC568\uD50C|\uC5E0\uD50C)/iu;

export function hasCriticalNumericContext(text: string) {
  if (extractNumericSignature(text).length === 0) return false;
  return (
    criticalMoneyContextPattern.test(text) ||
    koreanMoneyContextPattern.test(text) ||
    criticalClinicalUnitContextPattern.test(text)
  );
}

export function numberGuardEnabled() {
  return process.env.NUMBER_GUARD?.trim().toLowerCase() !== "off";
}
