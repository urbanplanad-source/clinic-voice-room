CREATE INDEX IF NOT EXISTS "TranslationRoom_hospitalId_status_lastActiveAt_idx"
ON "TranslationRoom" ("hospitalId", "status", "lastActiveAt");
