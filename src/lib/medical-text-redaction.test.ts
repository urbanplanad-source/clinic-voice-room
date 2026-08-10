import { describe, expect, it } from "vitest";
import { deidentifyMedicalText, hashMedicalText } from "./medical-text-redaction";

describe("medical text redaction", () => {
  it("redacts direct identifiers but preserves clinical numbers", () => {
    const result = deidentifyMedicalText("이름: 홍길동, 전화 010-1234-5678, 5mL를 하루 2번 복용하세요.");
    expect(result.text).toContain("[이름]");
    expect(result.text).toContain("[전화번호]");
    expect(result.text).toContain("5mL");
    expect(result.text).toContain("2번");
    expect(result.containsSensitiveData).toBe(true);
  });

  it("creates a stable hash without storing the original identifier", () => {
    expect(hashMedicalText(" test ")).toBe(hashMedicalText("test"));
    expect(hashMedicalText("test")).toHaveLength(64);
  });
});
