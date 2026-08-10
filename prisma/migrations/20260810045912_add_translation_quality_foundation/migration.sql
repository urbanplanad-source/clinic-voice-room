ALTER TABLE "TranslationSample"
ADD COLUMN "sourceTextHash" TEXT,
ADD COLUMN "translatedTextHash" TEXT,
ADD COLUMN "redactionTypes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "retentionExpiresAt" TIMESTAMP(3);

ALTER TABLE "TranslationFeedback"
ADD COLUMN "sourceTextHash" TEXT,
ADD COLUMN "translatedTextHash" TEXT,
ADD COLUMN "redactionTypes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

CREATE INDEX "TranslationSample_retentionExpiresAt_idx"
ON "TranslationSample"("retentionExpiresAt");

ALTER TABLE "TranslationSample" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TranslationFeedback" ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE "TranslationSample" FROM anon, authenticated;
REVOKE ALL ON TABLE "TranslationFeedback" FROM anon, authenticated;

ALTER TABLE "LocalInterpreterTurnMetric"
ADD COLUMN "messageId" TEXT,
ADD COLUMN "packVersion" TEXT,
ADD COLUMN "glossaryVersion" TEXT,
ADD COLUMN "normalizationVersion" INTEGER,
ADD COLUMN "modelId" TEXT,
ADD COLUMN "enginePath" TEXT,
ADD COLUMN "turnEndMode" TEXT,
ADD COLUMN "speechEndToTranscriptMs" INTEGER,
ADD COLUMN "requestRoundTripMs" INTEGER,
ADD COLUMN "exactMatchMs" INTEGER,
ADD COLUMN "glossaryMatchMs" INTEGER,
ADD COLUMN "translationMs" INTEGER,
ADD COLUMN "correctionMs" INTEGER,
ADD COLUMN "totalMs" INTEGER,
ADD COLUMN "initialDeterministicStatus" TEXT,
ADD COLUMN "finalDeterministicStatus" TEXT,
ADD COLUMN "semanticStatus" TEXT,
ADD COLUMN "validationPath" TEXT,
ADD COLUMN "riskLevel" TEXT,
ADD COLUMN "riskReasons" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "matchedEntryIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "modelAttemptCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "validationAttemptCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "correctionAttemptCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "strictAttemptCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "retryRequiredCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "estimatedCostUsd" DECIMAL(10,6);

CREATE INDEX "LocalInterpreterTurnMetric_packVersion_createdAt_idx"
ON "LocalInterpreterTurnMetric"("packVersion", "createdAt");

CREATE INDEX "LocalInterpreterTurnMetric_semanticStatus_createdAt_idx"
ON "LocalInterpreterTurnMetric"("semanticStatus", "createdAt");

CREATE TABLE "GlossaryAuditEvent" (
  "id" TEXT NOT NULL,
  "entryId" TEXT NOT NULL,
  "lineageId" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "hospitalId" TEXT,
  "actorStaffId" TEXT NOT NULL,
  "actorRole" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "fromLifecycle" TEXT,
  "toLifecycle" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GlossaryAuditEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "GlossaryAuditEvent_entryId_createdAt_idx" ON "GlossaryAuditEvent"("entryId", "createdAt");
CREATE INDEX "GlossaryAuditEvent_hospitalId_createdAt_idx" ON "GlossaryAuditEvent"("hospitalId", "createdAt");
CREATE INDEX "GlossaryAuditEvent_actorStaffId_createdAt_idx" ON "GlossaryAuditEvent"("actorStaffId", "createdAt");

ALTER TABLE "GlossaryAuditEvent" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "GlossaryAuditEvent" FROM anon, authenticated;

CREATE TABLE "GlossaryPackRelease" (
  "id" TEXT NOT NULL,
  "hospitalId" TEXT,
  "specialty" "HospitalSpecialty",
  "patientLanguage" "PatientLanguage",
  "direction" TEXT,
  "version" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'draft',
  "normalizationVersion" INTEGER NOT NULL,
  "checksumSha256" TEXT NOT NULL,
  "signature" TEXT NOT NULL,
  "signatureAlgorithm" TEXT NOT NULL DEFAULT 'Ed25519',
  "signingKeyId" TEXT NOT NULL,
  "minimumAppVersion" TEXT,
  "manifest" JSONB NOT NULL,
  "payload" JSONB NOT NULL,
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "activatedAt" TIMESTAMP(3),
  "retiredAt" TIMESTAMP(3),
  CONSTRAINT "GlossaryPackRelease_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "GlossaryPackRelease_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "Hospital"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "GlossaryPackRelease_version_key" ON "GlossaryPackRelease"("version");
CREATE INDEX "GlossaryPackRelease_hospitalId_status_createdAt_idx" ON "GlossaryPackRelease"("hospitalId", "status", "createdAt");
CREATE INDEX "GlossaryPackRelease_specialty_status_createdAt_idx" ON "GlossaryPackRelease"("specialty", "status", "createdAt");
CREATE INDEX "GlossaryPackRelease_patientLanguage_direction_status_idx" ON "GlossaryPackRelease"("patientLanguage", "direction", "status");

ALTER TABLE "GlossaryPackRelease" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "GlossaryPackRelease" FROM anon, authenticated;
