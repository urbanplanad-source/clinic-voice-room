CREATE TYPE "GlossaryScope" AS ENUM ('global', 'specialty', 'hospital');

CREATE TYPE "GlossaryEntryType" AS ENUM ('term', 'critical_phrase', 'transcription_hint');

CREATE TABLE "GlossaryEntry" (
  "id" TEXT NOT NULL,
  "scope" "GlossaryScope" NOT NULL,
  "specialty" "HospitalSpecialty",
  "hospitalId" TEXT,
  "entryType" "GlossaryEntryType" NOT NULL DEFAULT 'term',
  "spokenForms" TEXT[] NOT NULL,
  "standardKo" TEXT NOT NULL,
  "translations" JSONB NOT NULL,
  "category" TEXT,
  "note" TEXT,
  "priority" INTEGER NOT NULL DEFAULT 100,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "GlossaryEntry_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "GlossaryEntry_scope_specialty_isActive_idx" ON "GlossaryEntry"("scope", "specialty", "isActive");

CREATE INDEX "GlossaryEntry_hospitalId_isActive_idx" ON "GlossaryEntry"("hospitalId", "isActive");

ALTER TABLE "GlossaryEntry" ADD CONSTRAINT "GlossaryEntry_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "Hospital"("id") ON DELETE SET NULL ON UPDATE CASCADE;
