import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createRealtimeTranslationClientSecret,
  openAITranslationLanguageCode,
  RealtimeTranslationSessionError
} from "./openai-realtime-translation";

const originalApiKey = process.env.OPENAI_API_KEY;
const originalModel = process.env.OPENAI_STORE_TRANSLATION_MODEL;

afterEach(() => {
  vi.unstubAllGlobals();
  process.env.OPENAI_API_KEY = originalApiKey;
  process.env.OPENAI_STORE_TRANSLATION_MODEL = originalModel;
});

describe("createRealtimeTranslationClientSecret", () => {
  it("uses the dedicated translation client-secret endpoint and target language", async () => {
    process.env.OPENAI_API_KEY = "test-key";
    delete process.env.OPENAI_STORE_TRANSLATION_MODEL;
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ value: "short-lived-secret", expires_at: 1234 }), { status: 200 })
    );
    vi.stubGlobal("fetch", fetchMock);

    const token = await createRealtimeTranslationClientSecret({
      targetLanguage: "zh_tw",
      safetyIdentifier: "staff-1"
    });

    expect(token).toMatchObject({
      value: "short-lived-secret",
      realtimeModel: "gpt-realtime-translate",
      targetLanguage: "zh_tw",
      targetLanguageCode: "zh-TW"
    });
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.openai.com/v1/realtime/translations/client_secrets");
    expect(JSON.parse(String(init.body))).toEqual({
      session: {
        model: "gpt-realtime-translate",
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
            language: "zh-TW"
          }
        }
      }
    });
  });

  it("maps store languages to OpenAI output language codes", () => {
    expect(openAITranslationLanguageCode("ko")).toBe("ko");
    expect(openAITranslationLanguageCode("tl")).toBe("fil");
    expect(openAITranslationLanguageCode("yue")).toBe("yue");
  });

  it("surfaces OpenAI client-secret failures", async () => {
    process.env.OPENAI_API_KEY = "test-key";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: { message: "denied" } }), { status: 403 }))
    );

    await expect(
      createRealtimeTranslationClientSecret({ targetLanguage: "en", safetyIdentifier: "staff-1" })
    ).rejects.toEqual(expect.objectContaining<Partial<RealtimeTranslationSessionError>>({ status: 403 }));
  });
});
