import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getGlossaryForHospital } from "@/lib/glossary-service";
import { translateWithOpenAITextSafety } from "@/lib/openai-text-translation";
import { rateLimit } from "@/lib/rate-limit";
import { getCurrentStaff } from "@/lib/session";
import { recordTranslationSample } from "@/lib/translation-samples";
import { POST } from "./route";

vi.mock("@/lib/glossary-service", () => ({
  getGlossaryForHospital: vi.fn()
}));
vi.mock("@/lib/openai-text-translation", () => ({
  translateWithOpenAITextSafety: vi.fn()
}));
vi.mock("@/lib/rate-limit", () => ({
  clientIp: vi.fn(() => "127.0.0.1"),
  rateLimit: vi.fn(),
  rateLimitResponse: vi.fn((retryAfter: number) =>
    Response.json({ error: "Too many requests", retryAfter }, { status: 429 }))
}));
vi.mock("@/lib/session", () => ({
  getCurrentStaff: vi.fn()
}));
vi.mock("@/lib/translation-samples", () => ({
  recordTranslationSample: vi.fn(),
  stableTranslationSampleMessageId: vi.fn(() => "sample-message-id")
}));

const originalApiKey = process.env.OPENAI_API_KEY;

function validationRequest({
  direction = "patient_to_ko",
  force = true,
  forceReason = "patient_to_ko_pre_output",
  sourceText = "目を開けてください。",
  translatedText = "시작할게요."
}: {
  direction?: "ko_to_patient" | "patient_to_ko";
  force?: boolean;
  forceReason?: string;
  sourceText?: string;
  translatedText?: string;
} = {}) {
  return new Request("http://localhost/api/local-voice-turns/validate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      patientLanguage: "ja",
      direction,
      sourceText,
      translatedText,
      force,
      forceReason
    })
  });
}

describe("local voice validation recovery", () => {
  beforeEach(() => {
    process.env.OPENAI_API_KEY = "test-key";
    vi.mocked(getCurrentStaff).mockResolvedValue({
      id: "staff-1",
      hospitalId: "hospital-1",
      hospital: { specialty: "dermatology" }
    } as unknown as Awaited<ReturnType<typeof getCurrentStaff>>);
    vi.mocked(rateLimit).mockResolvedValue({ ok: true, remaining: 59, retryAfter: 0 });
    vi.mocked(getGlossaryForHospital).mockResolvedValue({
      terms: [],
      criticalPhrases: [],
      transcriptionHints: [],
      verifiedSentences: []
    });
    vi.mocked(recordTranslationSample).mockResolvedValue(null);
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
    process.env.OPENAI_API_KEY = originalApiKey;
  });

  it("returns a strict corrected translation when forced validation is unavailable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("validation timeout")));
    vi.mocked(translateWithOpenAITextSafety).mockResolvedValue({
      translatedText: "눈을 떠 주세요.",
      model: "gpt-5.5"
    });

    const response = await POST(validationRequest());

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      checked: true,
      ok: false,
      repaired: true,
      correctedTranslation: "눈을 떠 주세요."
    });
    expect(translateWithOpenAITextSafety).toHaveBeenCalledTimes(1);
    expect(recordTranslationSample).toHaveBeenCalledTimes(1);
  });

  it("does not add a strict repair to an optional validation failure", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("validation timeout")));

    const response = await POST(validationRequest({
      direction: "ko_to_patient",
      force: false,
      forceReason: "",
      sourceText: "무엇이 필요하신가요?",
      translatedText: "何が必要でしょうか。"
    }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      checked: false,
      ok: true,
      reason: "validation unavailable"
    });
    expect(translateWithOpenAITextSafety).not.toHaveBeenCalled();
  });

  it("rejects a forced repair that is still not Korean", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("validation timeout")));
    vi.mocked(translateWithOpenAITextSafety).mockResolvedValue({
      translatedText: "はい、目を開けてください。",
      model: "gpt-5.5"
    });

    const response = await POST(validationRequest());

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      checked: false,
      ok: true,
      reason: "validation unavailable"
    });
    expect(recordTranslationSample).not.toHaveBeenCalled();
  });
});
