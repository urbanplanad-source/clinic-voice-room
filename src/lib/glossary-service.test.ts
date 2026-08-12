import { describe, expect, it } from "vitest";
import { mergeApprovedVerifiedSentences, shouldInvalidateGlossaryCacheKey } from "./glossary-service";

describe("glossary cache invalidation", () => {
  it("invalidates every cached specialty variant for a hospital-scoped change", () => {
    expect(shouldInvalidateGlossaryCacheKey("hospital-a:dermatology", "hospital-a", null)).toBe(true);
    expect(shouldInvalidateGlossaryCacheKey("hospital-a:general", "hospital-a", null)).toBe(true);
    expect(shouldInvalidateGlossaryCacheKey("hospital-b:dermatology", "hospital-a", null)).toBe(false);
  });

  it("invalidates every hospital cache that uses the changed specialty", () => {
    expect(shouldInvalidateGlossaryCacheKey("hospital-a:dermatology", null, "dermatology")).toBe(true);
    expect(shouldInvalidateGlossaryCacheKey("hospital-b:dermatology", null, "dermatology")).toBe(true);
    expect(shouldInvalidateGlossaryCacheKey("hospital-b:general", null, "dermatology")).toBe(false);
  });
});
describe("approved verified sentence merge", () => {
  it("keeps approved global corrections when the DB has no matching sentence", () => {
    const merged = mergeApprovedVerifiedSentences([]);
    expect(merged.some((entry) => entry.entryId === "approved:PLAS0033:en")).toBe(true);
  });

  it("lets an active DB sentence override one target without duplicating the approved source", () => {
    const standardKo = "보형물의 제조사나 모델명은 확인된 기록에 근거해서만 문서에 적겠습니다.";
    const merged = mergeApprovedVerifiedSentences([{
      entryId: "db:hospital:PLAS0033",
      spoken: [],
      standardKo,
      translations: { en: "Hospital-approved English." },
      category: "hospital_verified",
      note: "internally approved"
    }]);

    const entry = merged.find((candidate) => candidate.entryId === "db:hospital:PLAS0033");
    expect(entry?.translations.en).toBe("Hospital-approved English.");
    expect(merged.filter((candidate) => candidate.standardKo === standardKo)).toHaveLength(1);
  });
});