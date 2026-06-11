ALTER TYPE "GlossaryEntryType" ADD VALUE 'verified_sentence';

ALTER TABLE "ConsultationMessage" ADD COLUMN "guardFlags" JSONB;
