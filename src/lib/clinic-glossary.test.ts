import { describe, expect, it } from "vitest";
import { buildClinicTranscriptionPrompt, normalizeClinicTranslation } from "./clinic-glossary";

describe("clinic glossary display normalization", () => {
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
    expect(buildClinicTranscriptionPrompt("ko")).toContain("Re2O");
    expect(buildClinicTranscriptionPrompt("ko")).toContain("리투오");
  });

  it("normalizes price-list treatment and brand names from dermatology and plastic surgery sheets", () => {
    expect(normalizeClinicTranslation("브이로어드밴스와 듀얼 프락셀", "en")).toContain("V-RO ADVANCE");
    expect(normalizeClinicTranslation("브이로어드밴스와 듀얼 프락셀", "en")).toContain("Fraxel Dual");
    expect(normalizeClinicTranslation("레스틸렌 비탈과 스컬트라", "zh")).toContain("瑞蓝唯提");
    expect(normalizeClinicTranslation("레스틸렌 비탈과 스컬트라", "zh")).toContain("塑颜翠");
    expect(normalizeClinicTranslation("브이라인 보톡스와 침샘 보톡스", "zh")).toContain("V脸肉毒素");
    expect(normalizeClinicTranslation("브이라인 보톡스와 침샘 보톡스", "zh")).toContain("腮腺肉毒素");
  });

  it("includes price-list terms in Korean transcription guidance", () => {
    const prompt = buildClinicTranscriptionPrompt("ko");
    expect(prompt).toContain("V-RO ADVANCE");
    expect(prompt).toContain("Restylane Vital");
    expect(prompt).toContain("Dysport");
  });
});
