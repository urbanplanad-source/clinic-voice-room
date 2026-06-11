export const highRiskKeywordGroups = {
  consent: ["동의", "동의서", "서명", "설명 들으신", "수술 내용", "시술 내용"],
  allergy: ["알레르기", "부작용", "이상 반응", "과민 반응"],
  contraindication: ["금기", "임신", "수유", "복용 중", "항응고", "혈전", "아스피린", "와파린"],
  pain_safety: ["통증", "마취", "응급", "출혈", "호흡", "어지러움", "심하면", "바로 말씀"]
} as const;

export type HighRiskCategory = keyof typeof highRiskKeywordGroups;

export function detectHighRisk(koreanText: string): { isHighRisk: boolean; categories: HighRiskCategory[] } {
  const normalized = koreanText.normalize("NFKC").toLocaleLowerCase();
  const categories = Object.entries(highRiskKeywordGroups)
    .filter(([, keywords]) => keywords.some((keyword) => normalized.includes(keyword.toLocaleLowerCase())))
    .map(([category]) => category as HighRiskCategory);

  return { isHighRisk: categories.length > 0, categories };
}
