import { describe, expect, it } from "vitest";
import { normalizeClinicTranslation } from "./clinic-glossary";

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
});
