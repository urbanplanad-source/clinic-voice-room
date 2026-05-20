ALTER TABLE "TranslationRoom"
ADD COLUMN IF NOT EXISTS "lastActiveAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

UPDATE "TranslationRoom"
SET "lastActiveAt" = GREATEST(COALESCE("patientJoinedAt", "createdAt"), "createdAt")
WHERE "status" <> 'ended'::"RoomStatus";
