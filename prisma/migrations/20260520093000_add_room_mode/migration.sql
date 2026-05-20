DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'RoomMode') THEN
    CREATE TYPE "RoomMode" AS ENUM ('consultation', 'procedure');
  END IF;
END
$$;

ALTER TABLE "TranslationRoom"
ADD COLUMN IF NOT EXISTS "roomMode" "RoomMode" NOT NULL DEFAULT 'consultation';
