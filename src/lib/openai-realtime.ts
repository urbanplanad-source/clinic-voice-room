import type { ParticipantRole, PatientLanguage } from "./languages";
import { createHash } from "crypto";
import { buildClinicTranscriptionPrompt } from "./clinic-glossary";

export type TranslationDirection = "staff_to_patient" | "patient_to_staff";

const realtimeInputLanguageHints: Record<PatientLanguage | "ko", string> = {
  ko: "ko",
  zh: "zh",
  zh_tw: "zh",
  ja: "ja",
  en: "en",
  th: "th",
  ms: "ms",
  mn: "mn",
  ru: "ru",
  vi: "vi",
  id: "id",
  fr: "fr",
  es: "es",
  de: "de",
  it: "it",
  pt: "pt"
};

const realtimeLanguageLabels: Record<PatientLanguage | "ko", string> = {
  ko: "Korean",
  zh: "Simplified Chinese",
  zh_tw: "Traditional Chinese",
  ja: "Japanese",
  en: "English",
  th: "Thai",
  ms: "Malay",
  mn: "Mongolian",
  ru: "Russian",
  vi: "Vietnamese",
  id: "Indonesian",
  fr: "French",
  es: "Spanish",
  de: "German",
  it: "Italian",
  pt: "Portuguese"
};

export function normalizedRealtimeModelName(value: string | undefined) {
  const trimmed = value?.trim();
  if (!trimmed || trimmed === "gpt-realtime-translate" || trimmed.startsWith("gpt-4o-realtime-preview")) return "gpt-realtime";
  return trimmed;
}

export function normalizedRealtimeTranscriptionModelName(value: string | undefined) {
  const trimmed = value?.trim();
  if (!trimmed || trimmed === "gpt-realtime-whisper" || trimmed === "gpt-4o-mini-transcribe") return "gpt-4o-transcribe";
  return trimmed;
}

function buildRealtimeTranslationInstructions(inputLanguage: PatientLanguage | "ko", outputLanguage: PatientLanguage | "ko") {
  const inputLabel = realtimeLanguageLabels[inputLanguage];
  const outputLabel = realtimeLanguageLabels[outputLanguage];
  const characterInstruction =
    outputLanguage === "zh_tw"
      ? "Use Traditional Chinese characters."
      : outputLanguage === "zh"
        ? "Use Simplified Chinese characters."
        : "";

  return [
    "You are a live medical interpreter for a Korean dermatology/plastic-surgery clinic.",
    `Translate the speaker from ${inputLabel} to ${outputLabel}.`,
    characterInstruction,
    "Output only the translated utterance. Do not add explanations, disclaimers, summaries, or extra conversation.",
    "Preserve clinic brand names such as Rejuran, Juvelook, Ultherapy, Thermage, Potenza, and Pico laser.",
    "For Korean procedure-room speech, interpret common clinic misrecognitions in context: Nijuran usually means Rejuran, and geujong usually means swelling or edema.",
    "Keep responses short and natural for immediate spoken playback."
  ].filter(Boolean).join(" ");
}

function isPromptCompatibilityError(detail: string) {
  return /(?:audio\.input\.transcription\.prompt|transcription\.prompt|prompt.*(?:unknown|unsupported|invalid|unrecognized)|(?:unknown|unsupported|invalid|unrecognized).*prompt)/i.test(detail);
}

export async function createRealtimeSessionToken(params: {
  role: ParticipantRole;
  patientLanguage: PatientLanguage;
  direction?: TranslationDirection;
  manualTurn?: boolean;
  safetyIdentifier?: string;
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
  const inputLanguage = params.direction
    ? params.direction === "staff_to_patient"
      ? "ko"
      : params.patientLanguage
    : params.role === "staff"
      ? "ko"
      : params.patientLanguage;
  const transcriptionPrompt = buildClinicTranscriptionPrompt(inputLanguage);
  const model = normalizedRealtimeModelName(process.env.OPENAI_REALTIME_MODEL);
  const transcriptionModel = normalizedRealtimeTranscriptionModelName(process.env.OPENAI_REALTIME_TRANSCRIPTION_MODEL);
  const safetyIdentifier = params.safetyIdentifier
    ? `clinic-voice-room-${createHash("sha256").update(params.safetyIdentifier).digest("hex").slice(0, 32)}`
    : `clinic-voice-room-${params.role}`;

  const requestSessionToken = (includeTranscriptionPrompt: boolean) =>
    fetch("https://api.openai.com/v1/realtime/client_secrets", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "OpenAI-Safety-Identifier": safetyIdentifier
      },
      body: JSON.stringify({
        expires_after: {
          anchor: "created_at",
          seconds: 600
        },
        session: {
          type: "realtime",
          model,
          instructions: buildRealtimeTranslationInstructions(inputLanguage, outputLanguage),
          audio: {
            input: {
              format: params.manualTurn ? { type: "audio/pcm", rate: 24000 } : undefined,
              transcription: includeTranscriptionPrompt
                ? { model: transcriptionModel, prompt: transcriptionPrompt, language: realtimeInputLanguageHints[inputLanguage] }
                : { model: transcriptionModel, language: realtimeInputLanguageHints[inputLanguage] },
              noise_reduction: { type: "near_field" },
              turn_detection: params.manualTurn ? null : undefined
            },
            output: {
              voice: process.env.OPENAI_REALTIME_VOICE ?? "marin"
            }
          }
        }
      })
    });

  let response = await requestSessionToken(Boolean(transcriptionPrompt));
  let detail = "";

  if (!response.ok) {
    detail = await response.text();
    if (transcriptionPrompt && isPromptCompatibilityError(detail)) {
      response = await requestSessionToken(false);
      detail = "";
    }
  }

  if (!response.ok) {
    detail ||= await response.text();
    throw new Error(`Realtime session token failed: ${response.status} ${detail}`);
  }

  const token = await response.json();
  return {
    ...token,
    realtimeModel: model,
    realtimeTranscriptionModel: transcriptionModel
  };
}
