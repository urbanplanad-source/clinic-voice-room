import { NextResponse } from "next/server";
import { ParticipantRole, Prisma, RoomMode } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentStaff } from "@/lib/session";

const statuses = ["new", "reviewed", "fixed", "dismissed"] as const;
const sources = ["local_voice", "consultation_voice", "procedure_voice"] as const;
const sampleBackfillLimit = 500;

const patchSchema = z.object({
  id: z.string().min(1),
  status: z.enum(statuses)
});

type SampleAdmin = NonNullable<Awaited<ReturnType<typeof getCurrentStaff>>>;

async function requireSampleAdmin() {
  const staff = await getCurrentStaff();
  if (!staff || staff.role === "staff") return null;
  return staff;
}

function sampleWhereFromRequest(request: Request, admin: SampleAdmin): Prisma.TranslationSampleWhereInput {
  const url = new URL(request.url);
  const id = url.searchParams.get("id") || undefined;
  const status = url.searchParams.get("status") || undefined;
  const hospitalId = url.searchParams.get("hospitalId") || undefined;
  const source = url.searchParams.get("source") || undefined;
  const where: Prisma.TranslationSampleWhereInput = {};

  if (id) where.id = id;
  if (admin.role === "hospital_admin") {
    where.hospitalId = admin.hospitalId;
  } else if (hospitalId) {
    where.hospitalId = hospitalId;
  }
  if (status && statuses.includes(status as (typeof statuses)[number])) {
    where.status = status as Prisma.EnumFeedbackStatusFilter["equals"];
  }
  if (source && sources.includes(source as (typeof sources)[number])) {
    where.source = source;
  }

  return where;
}

function sampleResponse(sample: {
  id: string;
  hospitalId: string;
  hospital?: { id: string; name: string; slug: string } | null;
  staffId: string | null;
  staff?: { id: string; name: string; email: string } | null;
  roomId: string | null;
  messageId: string | null;
  source: string;
  mode: string;
  direction: string;
  patientLanguage: string | null;
  sourceText: string;
  translatedText: string;
  sourceLanguage: string;
  targetLanguage: string;
  model: string | null;
  guardFlags: Prisma.JsonValue | null;
  status: (typeof statuses)[number];
  createdAt: Date;
  reviewedAt: Date | null;
}) {
  return {
    ...sample,
    createdAt: sample.createdAt.toISOString(),
    reviewedAt: sample.reviewedAt?.toISOString() ?? null
  };
}

function roomSampleSource(roomMode: RoomMode) {
  return roomMode === RoomMode.procedure ? "procedure_voice" : "consultation_voice";
}

function sampleDirection(speaker: ParticipantRole) {
  return speaker === ParticipantRole.staff ? "ko_to_patient" : "patient_to_ko";
}

function sampleSourceLanguage(speaker: ParticipantRole, patientLanguage: string) {
  return speaker === ParticipantRole.staff ? "ko" : patientLanguage;
}

function sampleTargetLanguage(speaker: ParticipantRole, patientLanguage: string, targetLanguage?: string | null) {
  if (targetLanguage) return targetLanguage;
  return speaker === ParticipantRole.staff ? patientLanguage : "ko";
}

async function backfillRoomTranslationSamples(request: Request, admin: SampleAdmin) {
  const url = new URL(request.url);
  const hospitalId = url.searchParams.get("hospitalId") || undefined;
  const source = url.searchParams.get("source") || undefined;
  const roomWhere: Prisma.TranslationRoomWhereInput = {
    roomMode: { in: [RoomMode.consultation, RoomMode.procedure] }
  };

  if (admin.role === "hospital_admin") {
    roomWhere.hospitalId = admin.hospitalId;
  } else if (hospitalId) {
    roomWhere.hospitalId = hospitalId;
  }
  if (source === "consultation_voice") {
    roomWhere.roomMode = RoomMode.consultation;
  } else if (source === "procedure_voice") {
    roomWhere.roomMode = RoomMode.procedure;
  } else if (source === "local_voice") {
    return;
  }

  const messages = await prisma.consultationMessage.findMany({
    where: {
      sourceText: { not: null },
      text: { not: "" },
      room: roomWhere
    },
    orderBy: { createdAt: "desc" },
    take: sampleBackfillLimit,
    include: {
      room: {
        select: {
          id: true,
          hospitalId: true,
          hostStaffId: true,
          patientLanguage: true,
          roomMode: true
        }
      }
    }
  });

  const sampleRows: Prisma.TranslationSampleCreateManyInput[] = [];
  for (const message of messages) {
    const sourceText = message.sourceText?.trim() ?? "";
    const translatedText = message.text.trim();
    if (!sourceText || !translatedText) continue;
    const patientLanguage = message.room.patientLanguage;

    sampleRows.push({
      hospitalId: message.room.hospitalId,
      staffId: message.room.hostStaffId,
      roomId: message.room.id,
      messageId: message.id,
      source: roomSampleSource(message.room.roomMode),
      mode: message.room.roomMode,
      direction: sampleDirection(message.speaker),
      patientLanguage,
      sourceText,
      translatedText,
      sourceLanguage: sampleSourceLanguage(message.speaker, patientLanguage),
      targetLanguage: sampleTargetLanguage(message.speaker, patientLanguage, message.targetLanguage),
      model: "backfill"
    });
  }

  if (sampleRows.length === 0) return;

  await prisma.translationSample.createMany({
    data: sampleRows,
    skipDuplicates: true
  });
}

export async function GET(request: Request) {
  const admin = await requireSampleAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  const where = sampleWhereFromRequest(request, admin);
  await backfillRoomTranslationSamples(request, admin).catch((caught) => {
    console.error("[admin samples backfill]", caught);
  });

  const samples = await prisma.translationSample.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      hospital: { select: { id: true, name: true, slug: true } },
      staff: { select: { id: true, name: true, email: true } }
    },
    take: where.id ? 1 : 300
  });

  const hospitals =
    admin.role === "internal_admin"
      ? await prisma.hospital.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, slug: true } })
      : [];

  return NextResponse.json({
    samples: where.id ? (samples[0] ? sampleResponse(samples[0]) : null) : samples.map(sampleResponse),
    hospitals,
    statuses,
    sources
  });
}

export async function PATCH(request: Request) {
  const admin = await requireSampleAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  const parsed = patchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid sample update payload" }, { status: 400 });

  const existing = await prisma.translationSample.findUnique({ where: { id: parsed.data.id } });
  if (!existing || (admin.role === "hospital_admin" && existing.hospitalId !== admin.hospitalId)) {
    return NextResponse.json({ error: "Sample not found" }, { status: 404 });
  }

  const sample = await prisma.translationSample.update({
    where: { id: parsed.data.id },
    data: { status: parsed.data.status, reviewedAt: parsed.data.status === "new" ? null : new Date() },
    include: { hospital: { select: { id: true, name: true, slug: true } }, staff: { select: { id: true, name: true, email: true } } }
  });

  return NextResponse.json({ sample: sampleResponse(sample) });
}
