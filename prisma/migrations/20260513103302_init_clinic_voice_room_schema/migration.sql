-- CreateEnum
CREATE TYPE "PlanType" AS ENUM ('partner_free', 'external_trial', 'external_paid');

-- CreateEnum
CREATE TYPE "HospitalStatus" AS ENUM ('active', 'suspended');

-- CreateEnum
CREATE TYPE "StaffRole" AS ENUM ('hospital_admin', 'staff', 'internal_admin');

-- CreateEnum
CREATE TYPE "PatientLanguage" AS ENUM ('zh', 'ja', 'en');

-- CreateEnum
CREATE TYPE "RoomStatus" AS ENUM ('waiting_for_patient', 'ready', 'staff_speaking', 'translating_to_patient', 'patient_listening', 'patient_speaking', 'translating_to_staff', 'staff_listening', 'ended', 'error');

-- CreateEnum
CREATE TYPE "ParticipantRole" AS ENUM ('staff', 'patient');

-- CreateEnum
CREATE TYPE "ConnectionState" AS ENUM ('connected', 'disconnected');

-- CreateTable
CREATE TABLE "Hospital" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "planType" "PlanType" NOT NULL DEFAULT 'partner_free',
    "status" "HospitalStatus" NOT NULL DEFAULT 'active',
    "monthlyIncludedMinutes" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Hospital_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffUser" (
    "id" TEXT NOT NULL,
    "hospitalId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "StaffRole" NOT NULL DEFAULT 'staff',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TranslationRoom" (
    "id" TEXT NOT NULL,
    "hospitalId" TEXT NOT NULL,
    "hostStaffId" TEXT NOT NULL,
    "patientLanguage" "PatientLanguage" NOT NULL,
    "roomToken" TEXT NOT NULL,
    "status" "RoomStatus" NOT NULL DEFAULT 'waiting_for_patient',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "patientJoinedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),

    CONSTRAINT "TranslationRoom_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoomParticipant" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "role" "ParticipantRole" NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leftAt" TIMESTAMP(3),
    "connectionState" "ConnectionState" NOT NULL DEFAULT 'connected',

    CONSTRAINT "RoomParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UsageSession" (
    "id" TEXT NOT NULL,
    "hospitalId" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "patientLanguage" "PatientLanguage" NOT NULL,
    "roomStartedAt" TIMESTAMP(3) NOT NULL,
    "roomEndedAt" TIMESTAMP(3),
    "totalRoomSeconds" INTEGER NOT NULL DEFAULT 0,
    "staffSpeakingSeconds" INTEGER,
    "patientSpeakingSeconds" INTEGER,
    "translatedAudioSeconds" INTEGER,
    "estimatedApiCostUsd" DECIMAL(10,4),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UsageSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Hospital_slug_key" ON "Hospital"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "StaffUser_email_key" ON "StaffUser"("email");

-- CreateIndex
CREATE UNIQUE INDEX "TranslationRoom_roomToken_key" ON "TranslationRoom"("roomToken");

-- CreateIndex
CREATE INDEX "RoomParticipant_roomId_role_idx" ON "RoomParticipant"("roomId", "role");

-- CreateIndex
CREATE UNIQUE INDEX "UsageSession_roomId_key" ON "UsageSession"("roomId");

-- AddForeignKey
ALTER TABLE "StaffUser" ADD CONSTRAINT "StaffUser_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "Hospital"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TranslationRoom" ADD CONSTRAINT "TranslationRoom_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "Hospital"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TranslationRoom" ADD CONSTRAINT "TranslationRoom_hostStaffId_fkey" FOREIGN KEY ("hostStaffId") REFERENCES "StaffUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoomParticipant" ADD CONSTRAINT "RoomParticipant_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "TranslationRoom"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UsageSession" ADD CONSTRAINT "UsageSession_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "Hospital"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UsageSession" ADD CONSTRAINT "UsageSession_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "StaffUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UsageSession" ADD CONSTRAINT "UsageSession_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "TranslationRoom"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
