import { describe, expect, it } from "vitest";
import { detectHighRiskConfirmationCategories, pendingPatientConfirmationGuard } from "./high-risk-confirmation";

describe("high-risk patient confirmation", () => {
  it("detects dose, frequency, number and negation", () => {
    expect(detectHighRiskConfirmationCategories("하루에 2번 5mg씩 복용하지 마세요.")).toEqual(
      expect.arrayContaining(["number", "dose_unit_frequency", "negation"])
    );
  });

  it("detects amount, date and laterality", () => {
    expect(detectHighRiskConfirmationCategories("오른쪽은 8월 12일에 30만원입니다.")).toEqual(
      expect.arrayContaining(["amount", "date_time", "laterality", "number"])
    );
  });

  it("only asks patients to confirm staff messages", () => {
    expect(pendingPatientConfirmationGuard("오늘은 음주하지 마세요.", "staff")?.confirmation?.status).toBe("pending");
    expect(pendingPatientConfirmationGuard("오늘은 음주하지 마세요.", "patient")).toBeUndefined();
  });
});
