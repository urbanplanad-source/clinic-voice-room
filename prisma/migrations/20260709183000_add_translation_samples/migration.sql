-- CreateTable
CREATE TABLE "TranslationSample" (
  "id" TEXT NOT NULL,
  "hospitalId" TEXT NOT NULL,
  "staffId" TEXT,
  "roomId" TEXT,
  "messageId" TEXT,
  "source" TEXT NOT NULL,
  "mode" TEXT NOT NULL,
  "direction" TEXT NOT NULL,
  "patientLanguage" "PatientLanguage",
  "sourceText" TEXT NOT NULL,
  "translatedText" TEXT NOT NULL,
  "sourceLanguage" TEXT NOT NULL,
  "targetLanguage" TEXT NOT NULL,
  "model" TEXT,
  "guardFlags" JSONB,
  "status" "FeedbackStatus" NOT NULL DEFAULT 'new',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reviewedAt" TIMESTAMP(3),

  CONSTRAINT "TranslationSample_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TranslationSample_hospitalId_source_messageId_key" ON "TranslationSample"("hospitalId", "source", "messageId");
CREATE INDEX "TranslationSample_hospitalId_status_createdAt_idx" ON "TranslationSample"("hospitalId", "status", "createdAt");
CREATE INDEX "TranslationSample_staffId_createdAt_idx" ON "TranslationSample"("staffId", "createdAt");
CREATE INDEX "TranslationSample_source_createdAt_idx" ON "TranslationSample"("source", "createdAt");

-- AddForeignKey
ALTER TABLE "TranslationSample" ADD CONSTRAINT "TranslationSample_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "Hospital"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TranslationSample" ADD CONSTRAINT "TranslationSample_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "StaffUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;