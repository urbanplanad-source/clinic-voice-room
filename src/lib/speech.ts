import type { PatientLanguage } from "./languages";

export const speechLanguageByPatientLanguage: Record<PatientLanguage | "ko", string> = {
  ko: "ko-KR",
  zh: "zh-CN",
  yue: "zh-HK",
  zh_tw: "zh-TW",
  ja: "ja-JP",
  en: "en-US",
  th: "th-TH",
  ms: "ms-MY",
  mn: "mn-MN",
  ru: "ru-RU",
  vi: "vi-VN",
  id: "id-ID",
  tl: "fil-PH",
  fr: "fr-FR",
  es: "es-ES",
  de: "de-DE",
  it: "it-IT",
  pt: "pt-PT"
};
