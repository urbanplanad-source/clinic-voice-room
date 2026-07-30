import { describe, expect, it } from "vitest";
import { shouldInvalidateGlossaryCacheKey } from "./glossary-service";

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
