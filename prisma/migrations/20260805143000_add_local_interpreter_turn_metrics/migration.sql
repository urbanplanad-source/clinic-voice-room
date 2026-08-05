CREATE TABLE "LocalInterpreterTurnMetric" (
    "id" TEXT NOT NULL,
    "hospitalId" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "patientLanguage" "PatientLanguage" NOT NULL,
    "direction" TEXT NOT NULL,
    "transport" TEXT NOT NULL,
    "outcome" TEXT NOT NULL,
    "resultReadyMs" INTEGER,
    "audioStartedMs" INTEGER,
    "validationMs" INTEGER,
    "validationStatus" TEXT,
    "corrected" BOOLEAN NOT NULL DEFAULT false,
    "verifiedSentence" BOOLEAN NOT NULL DEFAULT false,
    "errorCategory" TEXT,
    "appVersion" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LocalInterpreterTurnMetric_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "LocalInterpreterTurnMetric_hospitalId_createdAt_idx"
ON "LocalInterpreterTurnMetric"("hospitalId", "createdAt");

CREATE INDEX "LocalInterpreterTurnMetric_staffId_createdAt_idx"
ON "LocalInterpreterTurnMetric"("staffId", "createdAt");

CREATE INDEX "LocalInterpreterTurnMetric_patientLanguage_createdAt_idx"
ON "LocalInterpreterTurnMetric"("patientLanguage", "createdAt");

CREATE INDEX "LocalInterpreterTurnMetric_outcome_createdAt_idx"
ON "LocalInterpreterTurnMetric"("outcome", "createdAt");

ALTER TABLE "LocalInterpreterTurnMetric"
ADD CONSTRAINT "LocalInterpreterTurnMetric_hospitalId_fkey"
FOREIGN KEY ("hospitalId") REFERENCES "Hospital"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "LocalInterpreterTurnMetric"
ADD CONSTRAINT "LocalInterpreterTurnMetric_staffId_fkey"
FOREIGN KEY ("staffId") REFERENCES "StaffUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LocalInterpreterTurnMetric" ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE "LocalInterpreterTurnMetric" FROM anon, authenticated;