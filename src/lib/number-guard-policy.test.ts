import { afterEach, describe, expect, it } from "vitest";
import { hasCriticalNumericContext, numberGuardEnabled } from "./number-guard";

const originalNumberGuard = process.env.NUMBER_GUARD;

afterEach(() => {
  if (originalNumberGuard === undefined) {
    delete process.env.NUMBER_GUARD;
  } else {
    process.env.NUMBER_GUARD = originalNumberGuard;
  }
});

describe("number guard policy", () => {
  it("defaults on and supports an explicit emergency off switch", () => {
    delete process.env.NUMBER_GUARD;
    expect(numberGuardEnabled()).toBe(true);

    process.env.NUMBER_GUARD = "off";
    expect(numberGuardEnabled()).toBe(false);

    process.env.NUMBER_GUARD = "ON";
    expect(numberGuardEnabled()).toBe(true);
  });

  it("treats money and clinical units as critical numeric contexts", () => {
    expect(hasCriticalNumericContext("300,000\uC6D0\uC785\uB2C8\uB2E4.")).toBe(true);
    expect(hasCriticalNumericContext("1cc\uB97C \uC8FC\uC0AC\uD569\uB2C8\uB2E4.")).toBe(true);
    expect(hasCriticalNumericContext("600 \uC0F7\uC744 \uC9C4\uD589\uD569\uB2C8\uB2E4.")).toBe(true);
  });

  it("does not elevate dates or counts without money or a clinical unit", () => {
    expect(hasCriticalNumericContext("3\uC77C \uD6C4\uC5D0 \uC624\uC138\uC694.")).toBe(false);
    expect(hasCriticalNumericContext("2\uD68C \uBC29\uBB38\uD558\uC138\uC694.")).toBe(false);
  });
});
