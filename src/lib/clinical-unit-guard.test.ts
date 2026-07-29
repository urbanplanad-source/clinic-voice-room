import { describe, expect, it } from "vitest";
import {
  compareClinicalUnitSignatures,
  extractClinicalUnitSignature
} from "./clinical-unit-guard";

describe("clinical unit guard", () => {
  it("treats cc and mL as the same volume unit", () => {
    expect(compareClinicalUnitSignatures("Inject 1cc.", "Inject 1 mL.").ok).toBe(true);
  });

  it("rejects a volume unit changed to a mass unit", () => {
    const comparison = compareClinicalUnitSignatures("Inject 1cc.", "Inject 1mg.");

    expect(comparison.ok).toBe(false);
    expect(comparison.missing).toEqual(["volume_ml"]);
    expect(comparison.extra).toEqual(["mass_mg"]);
  });

  it("rejects swapped number-to-unit pairs", () => {
    const comparison = compareClinicalUnitSignatures(
      "Use 1cc and 2mg.",
      "Use 1mg and 2mL."
    );

    expect(comparison.ok).toBe(false);
    expect(comparison.pairMismatch).toBe(true);
    expect(comparison.sourcePairs).toEqual(["1:volume_ml", "2:mass_mg"]);
  });

  it("rejects a clinical unit introduced by the translation", () => {
    const comparison = compareClinicalUnitSignatures("Apply a small amount.", "Apply 1mg.");

    expect(comparison.ok).toBe(false);
    expect(comparison.extra).toEqual(["mass_mg"]);
  });

  it("treats Korean and English shot units as equivalent", () => {
    expect(compareClinicalUnitSignatures("600\uC0F7\uC73C\uB85C \uC9C4\uD589\uD569\uB2C8\uB2E4.", "We will use 600 shots.").ok)
      .toBe(true);
  });

  it("rejects an omitted clinical unit", () => {
    expect(compareClinicalUnitSignatures("Inject 2mg.", "Inject 2.").ok).toBe(false);
  });

  it("does not double-count gram inside milligram names", () => {
    expect(extractClinicalUnitSignature("1\uBC00\uB9AC\uADF8\uB7A8, 1\u30DF\u30EA\u30B0\u30E9\u30E0, 1\u6BEB\u514B"))
      .toEqual(["mass_mg", "mass_mg", "mass_mg"]);
  });

  it("ignores ordinary visit counts", () => {
    expect(extractClinicalUnitSignature("2\uD68C \uBC29\uBB38\uD558\uC138\uC694.")).toEqual([]);
  });
});
