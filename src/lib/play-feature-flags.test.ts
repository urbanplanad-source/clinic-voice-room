import { describe, expect, it } from "vitest";
import { readPlayFeatureFlags } from "./play-feature-flags";

describe("readPlayFeatureFlags", () => {
  it("keeps every Play feature disabled when values are missing", () => {
    expect(readPlayFeatureFlags({})).toEqual({
      billingEnabled: false,
      entitlementEnforcementEnabled: false,
      deviceLimitEnabled: false
    });
  });

  it("enables each feature only with the exact value on", () => {
    expect(
      readPlayFeatureFlags({
        PLAY_BILLING_ENABLED: "on",
        PLAY_ENTITLEMENT_ENFORCEMENT: "on",
        PLAY_DEVICE_LIMIT_ENABLED: "on"
      })
    ).toEqual({
      billingEnabled: true,
      entitlementEnforcementEnabled: true,
      deviceLimitEnabled: true
    });
  });

  it.each(["off", "true", "1", "ON", " on ", "typo"])("fails closed for %s", (value) => {
    expect(
      readPlayFeatureFlags({
        PLAY_BILLING_ENABLED: value,
        PLAY_ENTITLEMENT_ENFORCEMENT: value,
        PLAY_DEVICE_LIMIT_ENABLED: value
      })
    ).toEqual({
      billingEnabled: false,
      entitlementEnforcementEnabled: false,
      deviceLimitEnabled: false
    });
  });
});
