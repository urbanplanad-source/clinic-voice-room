import { createHash } from "node:crypto";
import type { TranslationLanguage } from "./languages";

export const defaultRealtimeTranslationModel = "gpt-realtime-translate";

const openAITranslationLanguageCodes: Record<TranslationLanguage, string> = {
  ko: "ko",
  zh: "zh",
  yue: "yue",
  zh_tw: "zh-TW",
  ja: "ja",
  en: "en",
  th: "th",
  vi: "vi",
  id: "id",
  ms: "ms",
  tl: "fil",
  mn: "mn",
  ru: "ru",
  fr: "fr",
  es: "es",
  de: "de",
  it: "it",
  pt: "pt"
};

export type RealtimeTranslationClientSecret = {
  value: string;
  expires_at?: number;
  session?: unknown;
  realtimeModel: string;
  targetLanguage: TranslationLanguage;
  targetLanguageCode: string;
};

export class RealtimeTranslationSessionError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
    this.name = "RealtimeTranslationSessionError";
  }
}

export function realtimeTranslationModelName() {
  return process.env.OPENAI_STORE_TRANSLATION_MODEL?.trim() || defaultRealtimeTranslationModel;
}

export function openAITranslationLanguageCode(language: TranslationLanguage) {
  return openAITranslationLanguageCodes[language];
}

export async function createRealtimeTranslationClientSecret(params: {
  targetLanguage: TranslationLanguage;
  safetyIdentifier: string;
  safetyScope?: string;
}): Promise<RealtimeTranslationClientSecret> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new RealtimeTranslationSessionError("OPENAI_API_KEY is not configured", 503);
  }

  const model = realtimeTranslationModelName();
  const targetLanguageCode = openAITranslationLanguageCode(params.targetLanguage);
  const safetyScope = params.safetyScope?.trim().replace(/[^a-z0-9-]/gi, "-") || "store-voice";
  const safetyIdentifier = `${safetyScope}-${createHash("sha256")
    .update(params.safetyIdentifier)
    .digest("hex")
    .slice(0, 32)}`;

  const response = await fetch("https://api.openai.com/v1/realtime/translations/client_secrets", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "OpenAI-Safety-Identifier": safetyIdentifier
    },
    body: JSON.stringify({
      session: {
        model,
        audio: {
          input: {
            transcription: {
              model: "gpt-realtime-whisper"
            },
            noise_reduction: {
              type: "near_field"
            }
          },
          output: {
            language: targetLanguageCode
          }
        }
      }
    })
  });

  const detail = await response.text();
  if (!response.ok) {
    throw new RealtimeTranslationSessionError(
      `Realtime translation client secret failed: ${response.status} ${detail}`,
      response.status
    );
  }

  let token: { value?: unknown; expires_at?: unknown; session?: unknown };
  try {
    token = JSON.parse(detail) as { value?: unknown; expires_at?: unknown; session?: unknown };
  } catch {
    throw new RealtimeTranslationSessionError("Realtime translation client secret returned invalid JSON", 502);
  }

  if (typeof token.value !== "string" || !token.value) {
    throw new RealtimeTranslationSessionError("Realtime translation client secret was missing a value", 502);
  }

  return {
    value: token.value,
    ...(typeof token.expires_at === "number" ? { expires_at: token.expires_at } : {}),
    ...(token.session !== undefined ? { session: token.session } : {}),
    realtimeModel: model,
    targetLanguage: params.targetLanguage,
    targetLanguageCode
  };
}
