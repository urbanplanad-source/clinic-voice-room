CREATE TABLE "TextTranslationUsage" (
    "id" TEXT NOT NULL,
    "hospitalId" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "sourceLanguage" TEXT NOT NULL,
    "targetLanguage" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TextTranslationUsage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TextTranslationUsage_hospitalId_createdAt_idx" ON "TextTranslationUsage"("hospitalId", "createdAt");
CREATE INDEX "TextTranslationUsage_staffId_createdAt_idx" ON "TextTranslationUsage"("staffId", "createdAt");
CREATE INDEX "TextTranslationUsage_sourceLanguage_targetLanguage_createdAt_idx" ON "TextTranslationUsage"("sourceLanguage", "targetLanguage", "createdAt");

ALTER TABLE "TextTranslationUsage"
ADD CONSTRAINT "TextTranslationUsage_hospitalId_fkey"
FOREIGN KEY ("hospitalId") REFERENCES "Hospital"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "TextTranslationUsage"
ADD CONSTRAINT "TextTranslationUsage_staffId_fkey"
FOREIGN KEY ("staffId") REFERENCES "StaffUser"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "TextTranslationUsage" ENABLE ROW LEVEL SECURITY;
