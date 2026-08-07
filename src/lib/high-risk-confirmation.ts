import type { GuardFlags } from "./guard-flags";

export const confirmationCategoryLabels: Record<string, string> = {
  number: "숫자",
  amount: "금액",
  date_time: "날짜·시간",
  dose_unit_frequency: "용량·횟수·단위",
  laterality: "좌우 위치",
  negation: "부정·금지"
};

const categoryPatterns: Array<[keyof typeof confirmationCategoryLabels, RegExp[]]> = [
  ["amount", [/(?:₩|\bKRW\b|원|만원|천원|달러|엔|위안|유로)/iu]],
  ["date_time", [/(?:오늘|내일|모레|어제|오전|오후|아침|점심|저녁|밤|주일|주간|개월|년|월|요일|시|분|시간|날짜)/u, /\b\d{1,4}[./-]\d{1,2}(?:[./-]\d{1,2})?\b/u]],
  ["dose_unit_frequency", [/(?:mg|mcg|g|kg|ml|mL|cc|IU|정|캡슐|포|방울|샷|회|번|차례|매일|하루|주당|개월마다)/iu]],
  ["laterality", [/(?:왼쪽|오른쪽|좌측|우측|양쪽|좌우)/u]],
  ["negation", [/(?:마세요|말아\s*주세요|않(?:습니다|아요|으세요)?|안\s|금지|피해\s*주세요|없(?:습니다|어요|으세요)?|못\s)/u]],
  ["number", [/[0-9０-９]+(?:[.,][0-9０-９]+)?/u, /(?:한|두|세|네|다섯|여섯|일곱|여덟|아홉|열)\s*(?:번|회|정|알|개|시간|분|일|주|개월|샷)/u]]
];

export function detectHighRiskConfirmationCategories(sourceText: string) {
  const text = sourceText.trim();
  if (!text) return [];
  return categoryPatterns
    .filter(([, patterns]) => patterns.some((pattern) => pattern.test(text)))
    .map(([category]) => category);
}

export function pendingPatientConfirmationGuard(sourceText: string, role: "staff" | "patient"): GuardFlags | undefined {
  if (role !== "staff") return undefined;
  const categories = detectHighRiskConfirmationCategories(sourceText);
  if (categories.length === 0) return undefined;
  return {
    confirmation: {
      required: true,
      categories,
      status: "pending"
    }
  };
}
