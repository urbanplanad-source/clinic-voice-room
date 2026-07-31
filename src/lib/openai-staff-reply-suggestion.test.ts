import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ClinicGlossaryData } from "./clinic-glossary";
import {
  buildStaffReplySuggestionInstructions,
  generateStaffReplySuggestionWithOpenAI
} from "./openai-staff-reply-suggestion";
import { CriticalNumericTranslationError } from "./openai-text-translation";

const glossaryData: ClinicGlossaryData = {
  terms: [],
  criticalPhrases: [],
  transcriptionHints: [],
  verifiedSentences: []
};

const originalModel = process.env.OPENAI_TEXT_TRANSLATION_MODEL;
const originalLightModel = process.env.OPENAI_TEXT_TRANSLATION_MODEL_LIGHT;
const originalNumberGuard = process.env.NUMBER_GUARD;

function responseWithReply(
  suggestedReplyKo: string,
  translatedReply: string
) {
  return new Response(JSON.stringify({
    output_text: JSON.stringify({ suggestedReplyKo, translatedReply })
  }), {
    status: 200,
    headers: { "Content-Type": "application/json" }
  });
}

function suggestionParams(customerMessageKo = "여기에서 예약할 수 있나요?") {
  return {
    apiKey: "test-key",
    safetyIdentifier: "test-safety",
    sourceLanguage: "zh" as const,
    customerSourceText: "这里可以预约吗？",
    customerMessageKo,
    glossaryData,
    timeoutMs: 2_000
  };
}

describe("staff reply suggestion", () => {
  beforeEach(() => {
    process.env.OPENAI_TEXT_TRANSLATION_MODEL = "standard-model";
    delete process.env.OPENAI_TEXT_TRANSLATION_MODEL_LIGHT;
    process.env.NUMBER_GUARD = "on";
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    process.env.OPENAI_TEXT_TRANSLATION_MODEL = originalModel;
    process.env.OPENAI_TEXT_TRANSLATION_MODEL_LIGHT = originalLightModel;
    process.env.NUMBER_GUARD = originalNumberGuard;
  });

  it("creates Korean first and translates that reply in one structured response", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(responseWithReply(
      "원하시는 시술과 날짜, 시간을 알려주시면 예약 가능 여부를 확인해 드리겠습니다.",
      "请告诉我们您想做的项目以及希望预约的日期和时间，我们会帮您确认是否可以预约。"
    ));
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      generateStaffReplySuggestionWithOpenAI(suggestionParams())
    ).resolves.toMatchObject({
      suggestedReplyKo:
        "원하시는 시술과 날짜, 시간을 알려주시면 예약 가능 여부를 확인해 드리겠습니다.",
      model: "standard-model"
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const request = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
    expect(request.text.format).toMatchObject({
      type: "json_schema",
      name: "staff_reply_suggestion",
      strict: true
    });
    expect(request.input[1].content[0].text).toContain(
      '"confirmedKoreanMeaning":"여기에서 예약할 수 있나요?"'
    );
  });

  it("keeps booking and medical claims unconfirmed in the prompt", () => {
    const instructions = buildStaffReplySuggestionInstructions(
      "ja",
      glossaryData
    );

    expect(instructions).toContain(
      "Do not claim that a booking is confirmed or available."
    );
    expect(instructions).toContain(
      "Do not invent or confirm prices"
    );
    expect(instructions).toContain(
      "For symptoms, side effects, allergies, pregnancy"
    );
  });

  it("retries when the foreign reply changes a price", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(responseWithReply(
        "가격은 300만원으로 안내되어 있습니다.",
        "费用是30万韩元。"
      ))
      .mockResolvedValueOnce(responseWithReply(
        "가격은 300만원으로 안내되어 있습니다.",
        "费用是300万韩元。"
      ));
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      generateStaffReplySuggestionWithOpenAI(
        suggestionParams("가격이 300만원인가요?")
      )
    ).resolves.toMatchObject({
      translatedReply: "费用是300万韩元。"
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("fails closed when the reply invents an unprovided price", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(responseWithReply(
        "가격은 300만원입니다.",
        "费用是300万韩元。"
      ))
      .mockResolvedValueOnce(responseWithReply(
        "가격은 300만원입니다.",
        "费用是300万韩元。"
      ));
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      generateStaffReplySuggestionWithOpenAI(
        suggestionParams("가격이 얼마인가요?")
      )
    ).rejects.toBeInstanceOf(CriticalNumericTranslationError);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
