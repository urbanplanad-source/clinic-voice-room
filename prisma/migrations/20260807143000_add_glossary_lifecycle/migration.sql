CREATE TYPE "GlossaryLifecycleStatus" AS ENUM ('draft', 'approved', 'active', 'retired');

ALTER TABLE "GlossaryEntry"
ADD COLUMN "lineageId" TEXT,
ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN "lifecycle" "GlossaryLifecycleStatus" NOT NULL DEFAULT 'active',
ADD COLUMN "approvedById" TEXT,
ADD COLUMN "approvedAt" TIMESTAMP(3),
ADD COLUMN "activatedById" TEXT,
ADD COLUMN "activatedAt" TIMESTAMP(3),
ADD COLUMN "retiredAt" TIMESTAMP(3);

UPDATE "GlossaryEntry"
SET "lineageId" = "id", "activatedAt" = COALESCE("updatedAt", "createdAt")
WHERE "lineageId" IS NULL;

ALTER TABLE "GlossaryEntry" ALTER COLUMN "lineageId" SET NOT NULL;

CREATE UNIQUE INDEX "GlossaryEntry_lineageId_version_key" ON "GlossaryEntry"("lineageId", "version");
CREATE INDEX "GlossaryEntry_lifecycle_updatedAt_idx" ON "GlossaryEntry"("lifecycle", "updatedAt");
