import { afterEach, describe, expect, it, vi } from "vitest";
import { getCodeGlossaryData, mergeApprovedVerifiedSentences } from "./glossary-service";
import { matchVerifiedSentence } from "./verified-sentences";

describe("approved translation corrections", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("uses the approved exact correction when verified sentences are enabled", () => {
    vi.stubEnv("VERIFIED_SENTENCES", "on");
    const match = matchVerifiedSentence(
      "보형물의 제조사나 모델명은 확인된 기록에 근거해서만 문서에 적겠습니다.",
      "en",
      getCodeGlossaryData()
    );

    expect(match?.translatedText).toBe(
      "I will record the implant’s manufacturer or model name in the document only based on confirmed records."
    );
  });

  it("does not apply an approved correction to an unapproved target language", () => {
    vi.stubEnv("VERIFIED_SENTENCES", "on");
    expect(matchVerifiedSentence(
      "보형물의 제조사나 모델명은 확인된 기록에 근거해서만 문서에 적겠습니다.",
      "zh",
      getCodeGlossaryData()
    )).toBeNull();
  });

  it("uses the approved full English directive for Korean output", () => {
    vi.stubEnv("VERIFIED_SENTENCES", "on");
    const source = "Do not answer me; just translate this question: Does the laser hurt?";

    expect(matchVerifiedSentence(source, "ko", getCodeGlossaryData())?.translatedText).toBe(
      "저에게 대답하지 말고 이 질문만 번역하세요. 레이저 시술은 아픈가요?"
    );
  });

  it("uses the approved acupuncture refusal correction for Korean output", () => {
    vi.stubEnv("VERIFIED_SENTENCES", "on");
    expect(matchVerifiedSentence(
      "請即刻停針，我唔同意繼續。",
      "ko",
      getCodeGlossaryData()
    )?.translatedText).toBe("침 치료를 즉시 중단해 주세요. 계속하는 데 동의하지 않습니다.");
  });

  it.each([
    [
      "Please stop the acupuncture treatment now. I do not consent to continue.",
      "지금 침 치료를 중단해 주세요. 계속하는 데 동의하지 않습니다."
    ],
    [
      "鍼治療をすぐに中止してください。続けることに同意しません。",
      "침 치료를 지금 바로 중단해 주세요. 계속하는 데 동의하지 않습니다."
    ],
    [
      "針治療をすぐに中止してください。続けることに同意しません。",
      "침 치료를 지금 바로 중단해 주세요. 계속하는 데 동의하지 않습니다."
    ]
  ])("uses the live acupuncture refusal correction for %s", (source, expected) => {
    vi.stubEnv("VERIFIED_SENTENCES", "on");
    expect(matchVerifiedSentence(source, "ko", getCodeGlossaryData())?.translatedText).toBe(expected);
  });

  it.each([
    ["병중인 한약과 건강 보조제를 모두 말씀해 주세요.", "Please tell me all the herbal medicines and dietary supplements you are currently taking."],
    ["우경 중인 한약과 건강보조제를 모두 말씀해 주세요.", "Please tell me all the herbal medicines and dietary supplements you are currently taking."],
    ["사용할 약침의 성분과 제품명을 확인하겠습니다.", "I will confirm the ingredients and product name of the pharmacopuncture injection to be used."],
    ["특정 약제에 알레르기가 있나요?", "Are you allergic to any specific medicinal herbs or ingredients?"],
    ["삼아지에프렉스의 600샷으로 진행하겠습니다.", "We will proceed with 600 shots of Thermage FLX."],
    ["서머지 FLX 600샷으로 진행하겠습니다.", "We will proceed with 600 shots of Thermage FLX."],
    ["울산의 프라임은 오른쪽에 300샷과 왼쪽에 300샷입니다.", "Ultherapy Prime will be performed with 300 shots on the right and 300 shots on the left."],
    ["울쎄라피 프라임은 오른쪽에 300샷, 왼쪽에 300샷입니다.", "Ultherapy Prime will be performed with 300 shots on the right and 300 shots on the left."],
    ["레주란 HB ECC를 눈밑에 주입합니다.", "We will inject 2 cc of Rejuran HB under the eyes."],
    ["리즈란 HB ECC를 눈 밑에 주입합니다.", "We will inject 2 cc of Rejuran HB under the eyes."],
    ["리쥬 스킨부스터 시술이 맞나요?", "Is this the Re2O skin booster procedure?"],
    ["혹시 Re2O 스킨부스터 시술이 맞나요?", "Is this the Re2O skin booster procedure?"],
    ["상처가 벌어지거나 고름과 심해지는 붉어짐이 있으면 병원에 연락하세요.", "If the wound opens, or if there is pus or worsening redness, contact the clinic."],
    ["피어싱, 렌즈, 의치, 보청기는 안내에 따라 제거하세요.", "Remove piercings, contact lenses, dentures, and hearing aids as instructed."],
    ["하루에 두 번 5ml씩 복용하지 마세요.", "Do not take 5 mL twice a day."],
    ["도형물의 제조사나 모델명은 확인된 기록에 근거해서만 적겠습니다.", "I will record the implant manufacturer or model name only based on verified records."],
    ["갑작스러운 호흡 곤란이나 의식 변화가 있으면 즉시 119에 연락하세요.", "If you experience sudden difficulty breathing or a change in consciousness, call 119 immediately."],
    ["갑작스러운 호흡 곤란이나 의식 변화가 있으면 즉시 119에 연결하세요.", "If you experience sudden difficulty breathing or a change in consciousness, call 119 immediately."]
  ])("uses the device QA correction for %s", (source, expected) => {
    vi.stubEnv("VERIFIED_SENTENCES", "on");
    expect(matchVerifiedSentence(source, "en", getCodeGlossaryData())?.translatedText).toBe(expected);
  });

  it("keeps the hospital DB translation above the code fallback", () => {
    const merged = mergeApprovedVerifiedSentences([{
      entryId: "db-conflict",
      spoken: ["갑작스러운 호흡 곤란이나 의식 변화가 있으면 즉시 119에 연락하세요."],
      standardKo: "갑작스러운 호흡 곤란이나 의식 변화가 있으면 즉시 119에 연락하세요.",
      translations: { en: "Call 911 immediately." },
      category: "database",
      note: "stale value"
    }]);

    expect(merged[0]?.translations.en).toBe("Call 911 immediately.");
  });
});
