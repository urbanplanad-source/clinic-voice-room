-- CreateEnum
CREATE TYPE "SubscriptionTier" AS ENUM ('standard', 'business');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM (
    'inactive',
    'pending',
    'active',
    'in_grace_period',
    'canceled',
    'on_hold',
    'paused',
    'expired',
    'revoked',
    'grandfathered'
);

-- CreateTable
CREATE TABLE "HospitalSubscription" (
    "id" TEXT NOT NULL,
    "hospitalId" TEXT NOT NULL,
    "trialStartedAt" TIMESTAMPTZ(3),
    "trialEndsAt" TIMESTAMPTZ(3),
    "currentTier" "SubscriptionTier",
    "pendingTier" "SubscriptionTier",
    "pendingTierEffectiveAt" TIMESTAMPTZ(3),
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'inactive',
    "entitlementExpiresAt" TIMESTAMPTZ(3),
    "maxActiveDevices" INTEGER,
    "obfuscatedAccountId" TEXT,
    "entitlementVersion" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "HospitalSubscription_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "HospitalSubscription_trial_window_check" CHECK (
        ("trialStartedAt" IS NULL AND "trialEndsAt" IS NULL)
        OR (
            "trialStartedAt" IS NOT NULL
            AND "trialEndsAt" = "trialStartedAt" + INTERVAL '24 hours'
        )
    ),
    CONSTRAINT "HospitalSubscription_pending_tier_check" CHECK (
        ("pendingTier" IS NULL AND "pendingTierEffectiveAt" IS NULL)
        OR ("pendingTier" IS NOT NULL AND "pendingTierEffectiveAt" IS NOT NULL)
    ),
    CONSTRAINT "HospitalSubscription_max_active_devices_check" CHECK (
        "maxActiveDevices" IS NULL OR "maxActiveDevices" > 0
    ),
    CONSTRAINT "HospitalSubscription_entitlement_version_check" CHECK (
        "entitlementVersion" > 0
    )
);

-- Existing hospitals intentionally receive no subscription row.
-- Rollout flags remain off until a separately approved activation.

-- CreateIndex
CREATE UNIQUE INDEX "HospitalSubscription_hospitalId_key" ON "HospitalSubscription"("hospitalId");

-- CreateIndex
CREATE UNIQUE INDEX "HospitalSubscription_obfuscatedAccountId_key" ON "HospitalSubscription"("obfuscatedAccountId");

-- CreateIndex
CREATE INDEX "HospitalSubscription_status_entitlementExpiresAt_idx"
ON "HospitalSubscription"("status", "entitlementExpiresAt");

-- CreateIndex
CREATE INDEX "HospitalSubscription_trialEndsAt_idx" ON "HospitalSubscription"("trialEndsAt");

-- CreateIndex
CREATE INDEX "HospitalSubscription_pendingTierEffectiveAt_idx"
ON "HospitalSubscription"("pendingTierEffectiveAt");

-- AddForeignKey
ALTER TABLE "HospitalSubscription"
ADD CONSTRAINT "HospitalSubscription_hospitalId_fkey"
FOREIGN KEY ("hospitalId") REFERENCES "Hospital"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

-- This table is server-only. Keep it unreachable from public Data API roles.
ALTER TABLE public."HospitalSubscription" ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public."HospitalSubscription" FROM anon, authenticated;
