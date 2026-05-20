CREATE TABLE "ConsultationMessage" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "speaker" "ParticipantRole" NOT NULL,
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConsultationMessage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ConsultationMessage_roomId_createdAt_idx" ON "ConsultationMessage"("roomId", "createdAt");

ALTER TABLE "ConsultationMessage" ADD CONSTRAINT "ConsultationMessage_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "TranslationRoom"("id") ON DELETE CASCADE ON UPDATE CASCADE;
