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
const originalLightModel = process.env.OPENAI_TEXT_TRANSLATION_MODEL_LIGHT;

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
    delete process.env.OPENAI_TEXT_TRANSLATION_MODEL_LIGHT;
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
    if (originalLightModel === undefined) {
      delete process.env.OPENAI_TEXT_TRANSLATION_MODEL_LIGHT;
    } else {
      process.env.OPENAI_TEXT_TRANSLATION_MODEL_LIGHT = originalLightModel;
    }
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

  it("accepts legacy routine staff phrases without waiting for model validation", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const cases = [
      ["이쪽으로 오시면 연고 마취 도와드릴게요", "こちらへお越しいただければ、麻酔クリームを塗ります。"],
      ["한의학 기반의 스킨 부스터입니다", "韓医学に基づいたスキンブースターです。"],
      ["이 원장님이 상담해 드릴게요", "院長のイ先生がご相談を担当します。"],
      ["2주에 한 번씩 주사를 맞아야 합니다", "2週間に1回、注射を受ける必要があります。"],
      ["이상으로 설명을 마칠게요", "以上で説明を終わります。"],
      ["기계가 더 이상 반응하지 않습니다", "The device no longer responds."],
      ["원 선생님이 진료합니다", "Dr. Yuan will see you."],
      ["만지지 않도록 꼭 주의해 주세요", "Avoid touching it at all costs."]
    ] as const;

    for (const [sourceText, translatedText] of cases) {
      const response = await POST(validationRequest({
        direction: "ko_to_patient",
        force: true,
        forceReason: "high_risk_translation",
        sourceText,
        translatedText
      }));

      expect(response.status, sourceText).toBe(200);
      await expect(response.json(), sourceText).resolves.toMatchObject({
        checked: true,
        ok: true,
        reason: "non-mandatory staff turn"
      });
    }

    expect(fetchMock).not.toHaveBeenCalled();
    expect(translateWithOpenAITextSafety).not.toHaveBeenCalled();
  });


  it("does not downgrade a forced turn when the translation introduces a monetary amount", async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json({
      output_text: JSON.stringify({ ok: true, reason: "", correctedTranslation: "" })
    }));
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(validationRequest({
      direction: "ko_to_patient",
      force: true,
      forceReason: "high_risk_translation",
      sourceText: "이제 시술을 시작할게요.",
      translatedText: "施術料は三百万円です。"
    }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ checked: true, ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("keeps side-effect meaning on model validation even when numbers match", async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json({
      output_text: JSON.stringify({ ok: true, reason: "", correctedTranslation: "" })
    }));
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(validationRequest({
      direction: "ko_to_patient",
      force: true,
      forceReason: "high_risk_translation",
      sourceText: "부작용은 3일간 지속될 수 있습니다.",
      translatedText: "副作用は3日間続く可能性があります。"
    }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ checked: true, ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("keeps amount meaning on model validation when the translation loses money context", async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json({
      output_text: JSON.stringify({ ok: true, reason: "", correctedTranslation: "" })
    }));
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(validationRequest({
      direction: "ko_to_patient",
      force: true,
      forceReason: "high_risk_translation",
      sourceText: "가격은 3만원입니다.",
      translatedText: "3回施術します。"
    }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ checked: true, ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("accepts a matching amount without an LLM validation round trip", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(validationRequest({
      direction: "ko_to_patient",
      force: true,
      forceReason: "high_risk_translation",
      sourceText: "써마지 가격은 300만원입니다.",
      translatedText: "サーマクールの料金は300万ウォンです。"
    }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      checked: true,
      ok: true,
      reason: "mandatory amount numbers matched"
    });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(translateWithOpenAITextSafety).not.toHaveBeenCalled();
    expect(recordTranslationSample).toHaveBeenCalledTimes(1);
  });

  it("does not accept a changed Korean currency scale as a matching amount", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    vi.mocked(translateWithOpenAITextSafety).mockResolvedValue({
      translatedText: "施術費は3億ウォンです。",
      model: "gpt-5.5"
    });

    const response = await POST(validationRequest({
      direction: "ko_to_patient",
      force: true,
      forceReason: "high_risk_translation",
      sourceText: "시술비는 3억 원입니다.",
      translatedText: "施術費は3ウォンです。"
    }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      checked: true,
      ok: false,
      repaired: true,
      correctedTranslation: "施術費は3億ウォンです。"
    });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(translateWithOpenAITextSafety).toHaveBeenCalledTimes(1);
  });

  it("repairs a mismatched amount directly without spending the validator timeout first", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    vi.mocked(translateWithOpenAITextSafety).mockResolvedValue({
      translatedText: "サーマクールの料金は300万ウォンです。",
      model: "gpt-5.5"
    });

    const response = await POST(validationRequest({
      direction: "ko_to_patient",
      force: true,
      forceReason: "high_risk_translation",
      sourceText: "써마지 가격은 300만원입니다.",
      translatedText: "サーマクールの料金は30万ウォンです。"
    }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      checked: true,
      ok: false,
      repaired: true,
      correctedTranslation: "サーマクールの料金は300万ウォンです。"
    });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(translateWithOpenAITextSafety).toHaveBeenCalledTimes(1);
  });

  it("uses the configured light model for validation while keeping strict repair standard", async () => {
    process.env.OPENAI_TEXT_TRANSLATION_MODEL_LIGHT = "fast-validation-model";
    const fetchMock = vi.fn().mockResolvedValue(Response.json({
      output_text: JSON.stringify({ ok: true, reason: "", correctedTranslation: "" })
    }));
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(validationRequest({
      direction: "ko_to_patient",
      force: true,
      forceReason: "high_risk_translation",
      sourceText: "부작용이 있을 수 있습니다.",
      translatedText: "副作用が生じる可能性があります。"
    }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ checked: true, ok: true });
    const requestInit = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(JSON.parse(String(requestInit.body))).toMatchObject({ model: "fast-validation-model" });
    expect(translateWithOpenAITextSafety).not.toHaveBeenCalled();
  });

  it("never uses a light-model correction as the final translated output", async () => {
    process.env.OPENAI_TEXT_TRANSLATION_MODEL_LIGHT = "fast-validation-model";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({
      output_text: JSON.stringify({
        ok: false,
        reason: "meaning mismatch",
        correctedTranslation: "빠른 모델이 만든 교정문"
      })
    })));
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
