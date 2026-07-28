import type { PatientLanguage, TranslationLanguage } from "./languages";

export const medivoiceHybridTranslationModes = ["off", "shadow", "low_risk_main"] as const;

export type MediVoiceHybridTranslationMode = (typeof medivoiceHybridTranslationModes)[number];
export type MediVoiceLocalDirection = "ko_to_patient" | "patient_to_ko";

const supportedPatientOutputLanguages = new Set<PatientLanguage>([
  "zh",
  "ja",
  "en",
  "vi",
  "id",
  "ru",
  "fr",
  "es",
  "de",
  "it",
  "pt"
]);

export function medivoiceHybridTranslationMode(
  value = process.env.MEDIVOICE_HYBRID_TRANSLATION_MODE
): MediVoiceHybridTranslationMode {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) return "low_risk_main";
  return medivoiceHybridTranslationModes.includes(normalized as MediVoiceHybridTranslationMode)
    ? (normalized as MediVoiceHybridTranslationMode)
    : "off";
}

export function supportsMediVoiceHybridLanguage(patientLanguage: PatientLanguage) {
  return supportedPatientOutputLanguages.has(patientLanguage);
}

export function medivoiceHybridTargetLanguage(
  patientLanguage: PatientLanguage,
  direction: MediVoiceLocalDirection
): TranslationLanguage {
  return direction === "ko_to_patient" ? patientLanguage : "ko";
}

export function medivoiceHybridPolicy(patientLanguage: PatientLanguage) {
  const configuredMode = medivoiceHybridTranslationMode();
  const languageSupported = supportsMediVoiceHybridLanguage(patientLanguage);
  const mode: MediVoiceHybridTranslationMode = languageSupported ? configuredMode : "off";

  return {
    mode,
    configuredMode,
    enabled: mode !== "off",
    languageSupported,
    refreshAfterMs: 30_000,
    reason: languageSupported
      ? mode === "off"
        ? "disabled_by_server"
        : "enabled"
      : "unsupported_patient_output_language"
  };
}
