import type { ParticipantRole, PatientLanguage } from "./languages";

export type TranslationDirection = "staff_to_patient" | "patient_to_staff";

const realtimeTranslationOutputLanguages: Record<PatientLanguage | "ko", string> = {
  ko: "ko",
  zh: "zh",
  ja: "ja",
  en: "en",
  ru: "ru",
  vi: "vi",
  id: "id"
};

export async function createRealtimeSessionToken(params: {
  role: ParticipantRole;
  patientLanguage: PatientLanguage;
  direction?: TranslationDirection;
}) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return {
      mode: "demo",
      client_secret: { value: "demo-token" },
      expires_at: Math.floor(Date.now() / 1000) + 60,
      note: "OPENAI_API_KEY is not configured. The UI will use demo playback."
    };
  }

  const outputLanguage = params.direction
    ? params.direction === "staff_to_patient"
      ? params.patientLanguage
      : "ko"
    : params.role === "staff"
      ? params.patientLanguage
      : "ko";
  const model = process.env.OPENAI_REALTIME_MODEL ?? "gpt-realtime-translate";
  const response = await fetch("https://api.openai.com/v1/realtime/translations/client_secrets", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "OpenAI-Safety-Identifier": `clinic-voice-room-${params.role}`
    },
    body: JSON.stringify({
      expires_after: {
        anchor: "created_at",
        seconds: 600
      },
      session: {
        model,
        audio: {
          input: {
            transcription: { model: "gpt-realtime-whisper" },
            noise_reduction: { type: "near_field" }
          },
          output: { language: realtimeTranslationOutputLanguages[outputLanguage] }
        }
      }
    })
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Realtime session token failed: ${response.status} ${detail}`);
  }

  return response.json();
}
