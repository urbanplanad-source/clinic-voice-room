import type { ParticipantRole, PatientLanguage } from "./languages";
import { createHash } from "crypto";
import { buildClinicGlossaryInstructions, buildClinicTranscriptionPrompt, type ClinicGlossaryData } from "./clinic-glossary";

export type TranslationDirection = "staff_to_patient" | "patient_to_staff";

const realtimeInputLanguageHints: Record<PatientLanguage | "ko", string> = {
  ko: "ko",
  zh: "zh",
  yue: "zh",
  zh_tw: "zh",
  ja: "ja",
  en: "en",
  th: "th",
  ms: "ms",
  mn: "mn",
  ru: "ru",
  vi: "vi",
  id: "id",
  tl: "tl",
  fr: "fr",
  es: "es",
  de: "de",
  it: "it",
  pt: "pt"
};

const realtimeLanguageLabels: Record<PatientLanguage | "ko", string> = {
  ko: "Korean",
  zh: "Simplified Chinese",
  yue: "Cantonese",
  zh_tw: "Traditional Chinese",
  ja: "Japanese",
  en: "English",
  th: "Thai",
  ms: "Malay",
  mn: "Mongolian",
  ru: "Russian",
  vi: "Vietnamese",
  id: "Indonesian",
  tl: "Filipino / Tagalog",
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

function buildRealtimeTranslationInstructions(inputLanguage: PatientLanguage | "ko", outputLanguage: PatientLanguage | "ko", glossaryData?: ClinicGlossaryData) {
  const inputLabel = realtimeLanguageLabels[inputLanguage];
  const outputLabel = realtimeLanguageLabels[outputLanguage];
  const patientLanguage = outputLanguage === "ko" ? inputLanguage : outputLanguage;
  const glossaryInstructions = patientLanguage === "ko" ? "" : buildClinicGlossaryInstructions(patientLanguage, glossaryData);
  const characterInstruction =
    outputLanguage === "yue"
      ? "Use natural Hong Kong Cantonese wording in Traditional Chinese characters."
      : outputLanguage === "zh_tw"
      ? "Use Traditional Chinese characters."
      : outputLanguage === "zh"
        ? "Use Simplified Chinese characters."
        : "";

  return [
    "You are a live medical interpreter for a Korean dermatology/plastic-surgery clinic.",
    `Translate the speaker from ${inputLabel} to ${outputLabel}.`,
    characterInstruction,
    "Output only the translated utterance. Do not add explanations, disclaimers, summaries, or extra conversation.",
    "Preserve clinic brand names such as Rejuran, Juvelook, Re2O, Ultherapy, Ultherapy Prime, Thermage FLX, XERF, Potenza, Pico laser, Restylane, Belotero, Sculptra, Skinvive, PRP, LDM, and HDA.",
    "For Korean procedure-room speech, interpret common clinic misrecognitions in context: Nijuran usually means Rejuran, and geujong usually means swelling or edema.",
    glossaryInstructions,
    "Keep responses short and natural for immediate spoken playback."
  ].filter(Boolean).join(" ");
}

function isPromptCompatibilityError(detail: string) {
  return /(?:audio\.input\.transcription\.prompt|transcription\.prompt|prompt.*(?:unknown|unsupported|invalid|unrecognized)|(?:unknown|unsupported|invalid|unrecognized).*prompt)/i.test(detail);
}

function isLanguageCompatibilityError(detail: string) {
  return /(?:audio\.input\.transcription\.language|transcription\.language|language.*(?:unknown|unsupported|invalid|unrecognized)|(?:unknown|unsupported|invalid|unrecognized).*language)/i.test(detail);
}

function isAudioOutputCompatibilityError(detail: string) {
  return /(?:output_modalities|audio\.output|output_audio|voice|audio output|output.*(?:unknown|unsupported|invalid|unrecognized)|(?:unknown|unsupported|invalid|unrecognized).*output|audio.*(?:unknown|unsupported|invalid|unrecognized)|(?:unknown|unsupported|invalid|unrecognized).*audio)/i.test(detail);
}

function buildRealtimeTurnDetection(manualTurn?: boolean) {
  return manualTurn ? null : undefined;
}

function shouldSendRealtimeLanguageHint(inputLanguage: PatientLanguage | "ko") {
  return inputLanguage !== "mn";
}

function realtimeTranscriptionConfig(
  inputLanguage: PatientLanguage | "ko",
  transcriptionModel: string,
  transcriptionPrompt: string,
  includeTranscriptionPrompt: boolean,
  includeLanguageHint: boolean
) {
  return {
    model: transcriptionModel,
    ...(includeTranscriptionPrompt ? { prompt: transcriptionPrompt } : {}),
    ...(includeLanguageHint ? { language: realtimeInputLanguageHints[inputLanguage] } : {})
  };
}

export async function createRealtimeSessionToken(params: {
  role: ParticipantRole;
  patientLanguage: PatientLanguage;
  direction?: TranslationDirection;
  manualTurn?: boolean;
  outputAudio?: boolean;
  safetyIdentifier?: string;
  glossaryData?: ClinicGlossaryData;
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
  const transcriptionPrompt = buildClinicTranscriptionPrompt(inputLanguage, params.glossaryData?.transcriptionHints);
  const model = normalizedRealtimeModelName(process.env.OPENAI_REALTIME_MODEL);
  const transcriptionModel = normalizedRealtimeTranscriptionModelName(process.env.OPENAI_REALTIME_TRANSCRIPTION_MODEL);
  const realtimeVoice = process.env.OPENAI_REALTIME_VOICE?.trim() || "marin";
  const safetyIdentifier = params.safetyIdentifier
    ? `clinic-voice-room-${createHash("sha256").update(params.safetyIdentifier).digest("hex").slice(0, 32)}`
    : `clinic-voice-room-${params.role}`;
  const requestedOutputAudio = Boolean(params.outputAudio);

  const requestSessionToken = (includeTranscriptionPrompt: boolean, outputAudio: boolean, includeLanguageHint: boolean) => {
    const manualTurnForRequest = Boolean(params.manualTurn);

    return fetch("https://api.openai.com/v1/realtime/client_secrets", {
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
          output_modalities: outputAudio ? ["audio"] : ["text"],
          instructions: buildRealtimeTranslationInstructions(inputLanguage, outputLanguage, params.glossaryData),
          audio: {
            input: {
              format: manualTurnForRequest ? { type: "audio/pcm", rate: 24000 } : undefined,
              transcription: realtimeTranscriptionConfig(
                inputLanguage,
                transcriptionModel,
                transcriptionPrompt,
                includeTranscriptionPrompt,
                includeLanguageHint
              ),
              noise_reduction: { type: "near_field" },
              turn_detection: buildRealtimeTurnDetection(manualTurnForRequest)
            },
            output: outputAudio ? { voice: realtimeVoice } : undefined
          }
        }
      })
    });
  };

  const requestCompatibleSessionToken = async (outputAudio: boolean) => {
    let includeTranscriptionPrompt = Boolean(transcriptionPrompt);
    let includeLanguageHint = shouldSendRealtimeLanguageHint(inputLanguage);
    let response = await requestSessionToken(includeTranscriptionPrompt, outputAudio, includeLanguageHint);
    let detail = "";

    for (let attempt = 0; attempt < 3 && !response.ok; attempt += 1) {
      detail = await response.text();
      if (includeLanguageHint && isLanguageCompatibilityError(detail)) {
        includeLanguageHint = false;
        response = await requestSessionToken(includeTranscriptionPrompt, outputAudio, includeLanguageHint);
        detail = "";
        continue;
      }
      if (includeTranscriptionPrompt && isPromptCompatibilityError(detail)) {
        includeTranscriptionPrompt = false;
        response = await requestSessionToken(includeTranscriptionPrompt, outputAudio, includeLanguageHint);
        detail = "";
        continue;
      }
      break;
    }

    return { response, detail };
  };

  let outputAudioEnabled = requestedOutputAudio;
  let { response, detail } = await requestCompatibleSessionToken(outputAudioEnabled);

  if (!response.ok && requestedOutputAudio) {
    detail ||= await response.text();
    if (isAudioOutputCompatibilityError(detail)) {
      outputAudioEnabled = false;
      ({ response, detail } = await requestCompatibleSessionToken(false));
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
    realtimeTranscriptionModel: transcriptionModel,
    realtimeOutputAudio: outputAudioEnabled
  };
}
