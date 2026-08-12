import { afterEach, describe, expect, it, vi } from "vitest";
import { buildClinicGlossaryInstructions, buildClinicInterpreterGlossaryInstructions, buildClinicTranscriptionPrompt, normalizeClinicSourceText, normalizeClinicTranslation } from "./clinic-glossary";

describe("clinic glossary display normalization", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("naturalizes Chinese shot and price phrasing for text translation", () => {
    expect(normalizeClinicTranslation("您好。Thermage 三百发是196万韩元。", "zh")).toBe(
      "您好，Thermage 300发的价格是196万韩元。"
    );
  });

  it("uses Traditional Chinese display for zh_tw text output", () => {
    expect(normalizeClinicTranslation("您好。Thermage 三百发是196万韩元。", "zh_tw")).toBe(
      "您好，Thermage 300發的價格是196萬韓元。"
    );
  });

  it("naturalizes Japanese shot and price phrasing for text translation", () => {
    expect(normalizeClinicTranslation("こんにちは。Thermage さんびゃくショットは196万ウォンです。", "ja")).toBe(
      "こんにちは。サーマクール300ショットの料金は196万ウォンです。"
    );
  });

  it("keeps English clinic counters numeric when the model spells them out", () => {
    expect(normalizeClinicTranslation("Thermage three hundred shots costs KRW 1.96 million.", "en")).toBe(
      "Thermage 300 shots costs KRW 1.96 million."
    );
  });

  it("normalizes Re2O Korean pronunciation variants to the approved brand display", () => {
    expect(normalizeClinicTranslation("리투오 주사", "en")).toBe("Re2O");
    expect(normalizeClinicTranslation("리투어 스킨부스터", "zh")).toContain("Re2O");
    expect(normalizeClinicTranslation("리트오 시술", "ja")).toContain("Re2O");
  });

  it("includes Re2O in Korean transcription guidance", () => {
    const prompt = buildClinicTranscriptionPrompt("ko");
    expect(prompt).toContain("Re2O");
    expect(prompt).toContain("리투오");
    expect(prompt).toContain("리쥬란");
    expect(prompt).toContain("never substitute one brand for the other");
    expect(prompt.length).toBeLessThanOrEqual(1_024);
  });

  it("normalizes common Thermage and Ultherapy Korean transcription variants", () => {
    expect(normalizeClinicTranslation("서머지 600샷", "ja")).toBe("サーマクール 600ショット");
    expect(normalizeClinicTranslation("써머지 FLX 600샷", "en")).toBe("Thermage FLX 600 shots");
    expect(normalizeClinicTranslation("웃음세라 시술", "en")).toBe("Ultherapy 시술");
    expect(normalizeClinicTranslation("올셀라와 울셀라", "ko")).toBe("울쎄라와 울쎄라");
  });

  it("includes Thermage and Ultherapy misrecognitions in Korean transcription guidance", () => {
    const prompt = buildClinicTranscriptionPrompt("ko");
    expect(prompt).toContain("서머지");
    expect(prompt).toContain("써마지");
    expect(prompt).toContain("울쎄라");
  });

  it("prioritizes approved Korean-medicine and safety terms in transcription guidance", () => {
    const prompt = buildClinicTranscriptionPrompt("ko");
    for (const term of ["한약", "약침", "약재", "의치", "보청기", "상처가 벌어지다", "심해지는 붉어짐"]) {
      expect(prompt).toContain(term);
    }
  });

  it("includes common Korean procedure phrases in transcription guidance", () => {
    const phrases = [
      "시술에 관심이 있으세요?",
      "시술을 진행하겠습니다",
      "시술 후에 주의해 주세요",
      "울쎄라 시술에 관심이 있으세요?"
    ];
    const prompt = buildClinicTranscriptionPrompt("ko", phrases, []);
    expect(prompt).toContain("시술에 관심이 있으세요?");
    expect(prompt).toContain("시술을 진행하겠습니다");
    expect(prompt).toContain("시술 후에 주의해 주세요");
    expect(prompt).toContain("울쎄라 시술에 관심이 있으세요?");
  });

  it("normalizes reviewed Korean acoustic near-matches to clinic terms", () => {
    const prompt = buildClinicTranscriptionPrompt("ko");
    expect(prompt).toContain("미주란");
    expect(prompt).toContain("울쎄라 핏 프라임");
    expect(normalizeClinicSourceText("미주란과 켄루이드, 울쎄라 핏 프라임 그리고 울새나"))
      .toBe("리쥬란과 켈로이드, 울쎄라피 프라임 그리고 울쎄라");
  });

  it("normalizes price-list treatment and brand names from dermatology and plastic surgery sheets", () => {
    expect(normalizeClinicTranslation("브이로어드밴스와 듀얼 프락셀", "en")).toContain("V-RO ADVANCE");
    expect(normalizeClinicTranslation("브이로어드밴스와 듀얼 프락셀", "en")).toContain("Fraxel Dual");
    expect(normalizeClinicTranslation("레스틸렌 비탈과 스컬트라", "zh")).toContain("瑞蓝唯提");
    expect(normalizeClinicTranslation("레스틸렌 비탈과 스컬트라", "zh")).toContain("塑颜翠");
    expect(normalizeClinicTranslation("브이라인 보톡스와 침샘 보톡스", "zh")).toContain("V脸肉毒素");
    expect(normalizeClinicTranslation("브이라인 보톡스와 침샘 보톡스", "zh")).toContain("腮腺肉毒素");
  });

  it("normalizes XERF when Korean speech is misheard as self lifting", () => {
    expect(normalizeClinicTranslation("세르프 리프팅", "en")).toBe("XERF");
    expect(normalizeClinicTranslation("셀프 리프팅", "en")).toBe("XERF");
    expect(normalizeClinicTranslation("Self lifting", "zh")).toBe("XERF");
  });

  it("includes price-list terms in Korean transcription guidance", () => {
    const prompt = buildClinicTranscriptionPrompt(
      "ko",
      ["V-RO ADVANCE", "Restylane Vital", "Dysport", "셀프 리프팅"],
      []
    );
    expect(prompt).toContain("V-RO ADVANCE");
    expect(prompt).toContain("Restylane Vital");
    expect(prompt).toContain("Dysport");
    expect(prompt).toMatch(/셀프\s?리프팅/);
  });

  it("includes the user-approved Chinese medical term corrections", () => {
    const prompt = buildClinicGlossaryInstructions("zh");
    expect(prompt).toContain("한약 => 中药 (never 韩药)");
    expect(prompt).toContain("붉어짐/발적 => 发红");
    expect(prompt).toContain("Never leave Korean words such as 안내 in Chinese output");
  });

  it("includes the user-approved English Korean-medicine terms", () => {
    const prompt = buildClinicGlossaryInstructions("en");
    expect(prompt).toContain("약침 => pharmacopuncture injection");
    expect(prompt).toContain("약재 => medicinal herbs or ingredients");
    expect(prompt).toContain("침 => acupuncture treatment");
    expect(prompt).toContain("주사 => injection");
  });

  it("uses Rejuran color-box names only as input aliases", () => {
    const prompt = buildClinicGlossaryInstructions("en");
    expect(prompt).toContain("Red Box => Rejuran HB");
    expect(prompt).toContain("- 리쥬란 HB: Rejuran HB");
    expect(prompt).not.toContain("- 리쥬란 HB: Rejuran Red Box");
    expect(normalizeClinicTranslation("Rejuran Red Box", "en")).toBe("Rejuran HB");
  });

  it("keeps acupuncture, pharmacopuncture, and injection distinct", () => {
    expect(normalizeClinicTranslation("침 치료", "en")).toBe("acupuncture treatment");
    expect(normalizeClinicTranslation("약침", "en")).toBe("pharmacopuncture injection");
    expect(normalizeClinicTranslation("주사", "en")).toBe("injection");
  });

  it("builds reverse Cantonese-to-Korean medical terminology and consent rules", () => {
    const prompt = buildClinicInterpreterGlossaryInstructions("yue", "ko");

    expect(prompt).toContain("藥針 => 약침");
    expect(prompt).toContain("停針 => 침 또는 침 치료");
    expect(prompt).toContain("never 주사");
    expect(prompt).toContain("never 약물 주사 or 일반 주사");
    expect(prompt).toContain("唔同意 => 동의하지 않습니다");
    expect(prompt).toContain("do not weaken it");
  });

  it("asks English transcription to preserve an instruction-like prefix", () => {
    const prompt = buildClinicTranscriptionPrompt("en");

    expect(prompt).toContain("from the first word to the last");
    expect(prompt).toContain("Do not answer me; just translate this question");
    expect(prompt).toContain("never return only the quoted question");
  });

  it("adds the medical disambiguation instruction only when the candidate is enabled", () => {
    vi.stubEnv("MEDICAL_STT_SAFETY_CANDIDATE", "off");
    expect(buildClinicTranscriptionPrompt("ko")).not.toContain("사용할, not 사용한");

    vi.stubEnv("MEDICAL_STT_SAFETY_CANDIDATE", "on");
    const prompt = buildClinicTranscriptionPrompt("ko");
    expect(prompt).toContain("약재 (medicinal herb), not 약제");
    expect(prompt).toContain("사용할, not 사용한");
    expect(prompt).toContain("보형물");
    expect(prompt).toContain("2cc");
    expect(prompt.length).toBeLessThanOrEqual(1_024);
  });
});
