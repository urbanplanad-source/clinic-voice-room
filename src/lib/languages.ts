export const patientLanguages = ["zh", "ja", "en", "ru", "vi", "id"] as const;

export type PatientLanguage = (typeof patientLanguages)[number];
export type ParticipantRole = "staff" | "patient";

export const languageLabels: Record<PatientLanguage, { ko: string; native: string; english: string }> = {
  zh: { ko: "중국어", native: "中文", english: "Chinese" },
  ja: { ko: "일본어", native: "日本語", english: "Japanese" },
  en: { ko: "영어", native: "English", english: "English" },
  ru: { ko: "러시아어", native: "Русский", english: "Russian" },
  vi: { ko: "베트남어", native: "Tiếng Việt", english: "Vietnamese" },
  id: { ko: "인도네시아어", native: "Bahasa Indonesia", english: "Indonesian" }
};

export const languageInstructions: Record<PatientLanguage, string> = {
  zh: "Translate spoken Korean into natural Mandarin Chinese, and Chinese into Korean. Keep output concise and suitable for a dermatology or plastic surgery consultation.",
  ja: "Translate spoken Korean into natural Japanese, and Japanese into Korean. Keep output concise and suitable for a dermatology or plastic surgery consultation.",
  en: "Translate spoken Korean into natural English, and English into Korean. Keep output concise and suitable for a dermatology or plastic surgery consultation.",
  ru: "Translate spoken Korean into natural Russian, and Russian into Korean. Keep output concise and suitable for a dermatology or plastic surgery consultation.",
  vi: "Translate spoken Korean into natural Vietnamese, and Vietnamese into Korean. Keep output concise and suitable for a dermatology or plastic surgery consultation.",
  id: "Translate spoken Korean into natural Indonesian, and Indonesian into Korean. Keep output concise and suitable for a dermatology or plastic surgery consultation."
};

export function isPatientLanguage(value: unknown): value is PatientLanguage {
  return typeof value === "string" && patientLanguages.includes(value as PatientLanguage);
}

export function sourceTargetFor(role: ParticipantRole, patientLanguage: PatientLanguage) {
  if (role === "staff") {
    return {
      sourceLanguage: "ko",
      targetLanguage: patientLanguage,
      instructions: `The staff speaks Korean. ${languageInstructions[patientLanguage]} Return only the translated text for the patient. Do not include explanations, labels, source text, or quotation marks.`
    };
  }

  return {
    sourceLanguage: patientLanguage,
    targetLanguage: "ko",
    instructions: `The patient speaks ${languageLabels[patientLanguage].english}. ${languageInstructions[patientLanguage]} Return only the translated Korean text for hospital staff. Do not include explanations, labels, source text, or quotation marks.`
  };
}
