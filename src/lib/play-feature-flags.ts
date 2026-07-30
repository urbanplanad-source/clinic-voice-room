export const playFeatureFlagEnvironmentKeys = [
  "PLAY_BILLING_ENABLED",
  "PLAY_ENTITLEMENT_ENFORCEMENT",
  "PLAY_DEVICE_LIMIT_ENABLED"
] as const;

export type PlayFeatureFlagEnvironmentKey = (typeof playFeatureFlagEnvironmentKeys)[number];

type PlayFeatureFlagEnvironment = Readonly<Record<string, string | undefined>>;

export type PlayFeatureFlags = Readonly<{
  billingEnabled: boolean;
  entitlementEnforcementEnabled: boolean;
  deviceLimitEnabled: boolean;
}>;

function isExplicitlyEnabled(value: string | undefined) {
  return value === "on";
}

export function readPlayFeatureFlags(environment: PlayFeatureFlagEnvironment = process.env): PlayFeatureFlags {
  return {
    billingEnabled: isExplicitlyEnabled(environment.PLAY_BILLING_ENABLED),
    entitlementEnforcementEnabled: isExplicitlyEnabled(environment.PLAY_ENTITLEMENT_ENFORCEMENT),
    deviceLimitEnabled: isExplicitlyEnabled(environment.PLAY_DEVICE_LIMIT_ENABLED)
  };
}
