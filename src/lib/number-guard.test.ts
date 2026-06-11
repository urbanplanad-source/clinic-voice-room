import { describe, expect, it } from "vitest";
import { compareNumericSignatures, extractNumericSignature } from "./number-guard";

function sorted(values: number[]) {
  return [...values].sort((a, b) => a - b);
}

describe("number guard", () => {
  it("extracts Arabic numbers, ranges, decimals, full-width digits, and Thai digits", () => {
    expect(sorted(extractNumericSignature("3~4회, 1.5ml, １주, ๒วัน"))).toEqual([1, 1.5, 2, 3, 4]);
  });

  it("extracts common Korean number words", () => {
    expect(sorted(extractNumericSignature("하루 두 번, 3일간 복용하세요"))).toEqual([2, 3]);
    expect(sorted(extractNumericSignature("사흘 동안 반 시간씩"))).toEqual([0.5, 3]);
  });

  it("detects a missing number in Korean to English", () => {
    const result = compareNumericSignatures("하루 두 번, 3일간 복용하세요", "Take it once a day for 3 days.");
    expect(result.ok).toBe(false);
    expect(result.missing).toContain(2);
  });

  it("passes matching Korean to English numbers", () => {
    expect(compareNumericSignatures("하루 두 번, 3일간 복용하세요", "Take it 2 times a day for 3 days.").ok).toBe(true);
  });

  it("handles Chinese week phrasing without a false positive", () => {
    expect(compareNumericSignatures("一周后复诊", "일주일 후 재방문").ok).toBe(true);
  });

  it("handles Korean to Chinese and Japanese fixture pairs", () => {
    expect(compareNumericSignatures("3일 후 다시 오세요", "请3天后再来。").ok).toBe(true);
    expect(compareNumericSignatures("2주 동안 술은 피해주세요", "2週間は飲酒を避けてください。").ok).toBe(true);
  });

  it("handles Korean to Thai fixture pairs", () => {
    expect(compareNumericSignatures("하루 두 번 발라주세요", "ทาวันละ ๒ ครั้ง").ok).toBe(true);
    expect(compareNumericSignatures("3일 동안 복용하세요", "รับประทานเป็นเวลา ๓ วัน").ok).toBe(true);
  });

  it("does not trigger when the source has no numbers", () => {
    expect(compareNumericSignatures("오늘은 음주를 피해주세요", "Please avoid alcohol today and tomorrow.").ok).toBe(true);
  });
});
