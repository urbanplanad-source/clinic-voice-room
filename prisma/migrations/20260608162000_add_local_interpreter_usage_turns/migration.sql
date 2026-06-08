CREATE TABLE "LocalInterpreterUsageTurn" (
    "id" TEXT NOT NULL,
    "hospitalId" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "patientLanguage" "PatientLanguage" NOT NULL,
    "direction" TEXT NOT NULL,
    "transport" TEXT NOT NULL,
    "durationSeconds" INTEGER NOT NULL DEFAULT 0,
    "sourceTextCharacters" INTEGER,
    "translatedTextCharacters" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LocalInterpreterUsageTurn_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "LocalInterpreterUsageTurn_hospitalId_createdAt_idx" ON "LocalInterpreterUsageTurn"("hospitalId", "createdAt");
CREATE INDEX "LocalInterpreterUsageTurn_staffId_createdAt_idx" ON "LocalInterpreterUsageTurn"("staffId", "createdAt");
CREATE INDEX "LocalInterpreterUsageTurn_patientLanguage_createdAt_idx" ON "LocalInterpreterUsageTurn"("patientLanguage", "createdAt");

ALTER TABLE "LocalInterpreterUsageTurn" ADD CONSTRAINT "LocalInterpreterUsageTurn_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "Hospital"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LocalInterpreterUsageTurn" ADD CONSTRAINT "LocalInterpreterUsageTurn_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "StaffUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "LocalInterpreterUsageTurn" ENABLE ROW LEVEL SECURITY;
