CREATE TYPE "FeedbackStatus" AS ENUM ('new', 'reviewed', 'fixed', 'dismissed');

CREATE TABLE "TranslationFeedback" (
  "id" TEXT NOT NULL,
  "hospitalId" TEXT NOT NULL,
  "roomId" TEXT,
  "messageId" TEXT,
  "sourceText" TEXT NOT NULL,
  "translatedText" TEXT NOT NULL,
  "sourceLanguage" TEXT NOT NULL,
  "targetLanguage" TEXT NOT NULL,
  "reporterRole" TEXT NOT NULL,
  "reason" TEXT,
  "status" "FeedbackStatus" NOT NULL DEFAULT 'new',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reviewedAt" TIMESTAMP(3),

  CONSTRAINT "TranslationFeedback_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TranslationFeedback_hospitalId_status_createdAt_idx" ON "TranslationFeedback"("hospitalId", "status", "createdAt");

ALTER TABLE "TranslationFeedback" ADD CONSTRAINT "TranslationFeedback_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "Hospital"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
