CREATE TABLE "HospitalQuickPhrase" (
  "id" TEXT NOT NULL,
  "hospitalId" TEXT NOT NULL,
  "stage" TEXT,
  "ko" TEXT NOT NULL,
  "translations" JSONB NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 100,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "HospitalQuickPhrase_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "HospitalQuickPhrase_hospitalId_isActive_sortOrder_idx" ON "HospitalQuickPhrase"("hospitalId", "isActive", "sortOrder");

ALTER TABLE "HospitalQuickPhrase" ADD CONSTRAINT "HospitalQuickPhrase_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "Hospital"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
