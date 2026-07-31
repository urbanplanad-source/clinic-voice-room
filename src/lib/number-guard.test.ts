import { describe, expect, it } from "vitest";
import {
  compareNumericSignatures,
  extractNumericSignature,
  hasCriticalNumericContext
} from "./number-guard";

function sorted(values: number[]) {
  return [...values].sort((a, b) => a - b);
}

describe("number guard", () => {
  it("extracts Arabic numbers, ranges, decimals, full-width digits, and Thai digits", () => {
    expect(sorted(extractNumericSignature("3~4\uD68C, 1.5ml, \uFF11\uC8FC, \u0E52\u0E27\u0E31\u0E19"))).toEqual([1, 1.5, 2, 3, 4]);
  });

  it("extracts common Korean number words", () => {
    expect(sorted(extractNumericSignature("\uD558\uB8E8 \uB450 \uBC88, 3\uC77C\uAC04 \uBCF5\uC6A9\uD558\uC138\uC694"))).toEqual([2, 3]);
    expect(sorted(extractNumericSignature("\uC0AC\uD758 \uB3D9\uC548 \uBC18 \uC2DC\uAC04\uC529"))).toEqual([0.5, 3]);
  });

  it("does not read ordinary Korean words as numbers or prices", () => {
    const source = "원장님이 알맞은 상품으로 추천해줄거야";

    expect(extractNumericSignature(source)).toEqual([]);
    expect(hasCriticalNumericContext(source)).toBe(false);
    expect(compareNumericSignatures(source, "The director will recommend a suitable product.").ok).toBe(true);
  });

  it("does not read the director title as currency when another number exists", () => {
    const source = "원장님이 2가지 상품을 추천합니다.";

    expect(extractNumericSignature(source)).toEqual([2]);
    expect(hasCriticalNumericContext(source)).toBe(false);
  });

  it("keeps real Korean count units while rejecting word prefixes", () => {
    expect(extractNumericSignature("약을 이 알 복용하세요.")).toEqual([2]);
    expect(extractNumericSignature("한 번 확인해 주세요.")).toEqual([1]);
    expect(extractNumericSignature("한 번역 결과입니다.")).toEqual([]);
  });

  it("keeps actual Korean won amounts in the critical path", () => {
    expect(hasCriticalNumericContext("가격은 300원입니다.")).toBe(true);
    expect(hasCriticalNumericContext("가격은 300만원입니다.")).toBe(true);
    expect(hasCriticalNumericContext("가격은 삼백 원입니다.")).toBe(true);
  });

  it("detects a missing number in Korean to English", () => {
    const result = compareNumericSignatures("\uD558\uB8E8 \uB450 \uBC88, 3\uC77C\uAC04 \uBCF5\uC6A9\uD558\uC138\uC694", "Take it once a day for 3 days.");
    expect(result.ok).toBe(false);
    expect(result.missing).toContain(2);
  });

  it("passes matching Korean to English numbers", () => {
    expect(compareNumericSignatures("\uD558\uB8E8 \uB450 \uBC88, 3\uC77C\uAC04 \uBCF5\uC6A9\uD558\uC138\uC694", "Take it 2 times a day for 3 days.").ok).toBe(true);
  });

  it("handles Chinese week phrasing without a false positive", () => {
    expect(compareNumericSignatures("\u4E00\u5468\u540E\u590D\u8BCA", "\uC77C\uC8FC\uC77C \uD6C4 \uC7AC\uBC29\uBB38").ok).toBe(true);
  });

  it("treats equivalent ten-thousand currency notation as the same amount", () => {
    expect(compareNumericSignatures("300만원입니다.", "The price is 3,000,000 won.").ok).toBe(true);
    expect(compareNumericSignatures("300만 원입니다.", "300万ウォンです。").ok).toBe(true);
    expect(compareNumericSignatures("1.5만원입니다.", "15,000 KRW").ok).toBe(true);
  });

  it("still rejects a changed ten-thousand currency amount", () => {
    const comparison = compareNumericSignatures("300만원입니다.", "The price is 300,000 won.");
    expect(comparison.ok).toBe(false);
    expect(comparison.missing).toContain(3_000_000);
    expect(comparison.extra).toContain(300_000);
  });

  it("handles Korean to Chinese and Japanese fixture pairs", () => {
    expect(compareNumericSignatures("3\uC77C \uD6C4 \uB2E4\uC2DC \uC624\uC138\uC694", "\u8BF7\u0033\u5929\u540E\u518D\u6765\u3002").ok).toBe(true);
    expect(compareNumericSignatures("2\uC8FC \uB3D9\uC548 \uC220\uC740 \uD53C\uD574\uC8FC\uC138\uC694", "2\u9031\u9593\u306F\u98F2\u9152\u3092\u907F\u3051\u3066\u304F\u3060\u3055\u3044\u3002").ok).toBe(true);
  });

  it("handles Korean to Thai fixture pairs", () => {
    expect(compareNumericSignatures("\uD558\uB8E8 \uB450 \uBC88 \uBC1C\uB77C\uC8FC\uC138\uC694", "\u0E17\u0E32\u0E27\u0E31\u0E19\u0E25\u0E30 \u0E52 \u0E04\u0E23\u0E31\u0E49\u0E07").ok).toBe(true);
    expect(compareNumericSignatures("3\uC77C \uB3D9\uC548 \uBCF5\uC6A9\uD558\uC138\uC694", "\u0E23\u0E31\u0E1A\u0E1B\u0E23\u0E30\u0E17\u0E32\u0E19\u0E40\u0E1B\u0E47\u0E19\u0E40\u0E27\u0E25\u0E32 \u0E53 \u0E27\u0E31\u0E19").ok).toBe(true);
  });

  it("does not trigger when neither side has numeric values", () => {
    expect(compareNumericSignatures("\uC624\uB298\uC740 \uC74C\uC8FC\uB97C \uD53C\uD574\uC8FC\uC138\uC694", "Please avoid alcohol today and tomorrow.").ok).toBe(true);
  });

  it("detects a numeric value introduced by the translation", () => {
    const comparison = compareNumericSignatures("\uAD1C\uCC2E\uC2B5\uB2C8\uB2E4.", "It costs 300,000 won.");

    expect(comparison.ok).toBe(false);
    expect(comparison.extra).toEqual([300000]);
  });
});
