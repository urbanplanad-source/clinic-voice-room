ALTER TABLE "TranslationRoom" ADD COLUMN "patientJoinCode" TEXT;

CREATE UNIQUE INDEX "TranslationRoom_patientJoinCode_key" ON "TranslationRoom"("patientJoinCode");
