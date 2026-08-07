import { NextResponse } from "next/server";
import { ParticipantRole, Prisma, RoomMode } from "@prisma/client";
import { z } from "zod";
import { normalizeTranscriptionKey } from "@/lib/clinic-transcription";
import { clearGlossaryCache, findGlossaryAliasConflict } from "@/lib/glossary-service";
import { prisma } from "@/lib/prisma";
import { getCurrentStaff } from "@/lib/session";

const statuses = ["new", "reviewed", "fixed", "dismissed"] as const;
const sources = ["local_voice", "consultation_voice", "procedure_voice"] as const;
const reviewKinds = ["source_correct", "stt_error", "translation_error", "noise", "uncertain"] as const;
const promotionScopes = ["hospital", "specialty", "global"] as const;
const sampleBackfillLimit = 500;

const patchSchema = z.object({
  id: z.string().min(1),
  status: z.enum(statuses).optional(),
  reviewKind: z.enum(reviewKinds).optional(),
  correctedSourceText: z.string().trim().max(500).optional(),
  reviewNote: z.string().trim().max(500).optional(),
  hintObservedForm: z.string().trim().max(200).optional(),
  hintCanonicalForm: z.string().trim().max(200).optional(),
  hintCategory: z.string().trim().max(120).optional(),
  promotionScope: z.enum(promotionScopes).optional(),
  promoteToSttHint: z.boolean().optional()
}).superRefine((value, context) => {
  if (!value.status && !value.reviewKind) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "status or reviewKind is required" });
  }
  if (value.promoteToSttHint) {
    if (value.reviewKind !== "stt_error") {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "Only an STT error can be promoted" });
    }
    if (!value.hintObservedForm || !value.hintCanonicalForm) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "Observed and canonical forms are required" });
    }
  }
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

function jsonRecord(value: Prisma.JsonValue | null) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, Prisma.JsonValue>;
}

function uniqueSpokenForms(values: string[]) {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const rawValue of values) {
    const value = rawValue.trim().replace(/\s+/g, " ");
    const key = normalizeTranscriptionKey(value);
    if (!value || !key || seen.has(key)) continue;
    seen.add(key);
    result.push(value);
  }
  return result;
}

function reviewStatus(reviewKind: (typeof reviewKinds)[number] | undefined, requestedStatus: (typeof statuses)[number] | undefined, promoted: boolean) {
  if (promoted) return "fixed" as const;
  if (requestedStatus) return requestedStatus;
  if (reviewKind === "noise") return "dismissed" as const;
  return reviewKind ? "reviewed" as const : "new" as const;
}

async function promoteSttHint({
  tx,
  admin,
  sample,
  observedForm,
  canonicalForm,
  requestedScope,
  category
}: {
  tx: Prisma.TransactionClient;
  admin: SampleAdmin;
  sample: { id: string; hospitalId: string; sourceLanguage: string };
  observedForm: string;
  canonicalForm: string;
  requestedScope: (typeof promotionScopes)[number] | undefined;
  category: string | undefined;
}) {
  if (sample.sourceLanguage !== "ko") throw new Error("Only Korean source samples can be promoted to an STT hint");

  const observed = observedForm.trim().replace(/\s+/g, " ");
  const canonical = canonicalForm.trim().replace(/\s+/g, " ");
  if (!observed || !canonical || normalizeTranscriptionKey(observed) === normalizeTranscriptionKey(canonical)) {
    throw new Error("Observed and canonical forms must be different");
  }

  const hospital = await tx.hospital.findUnique({
    where: { id: sample.hospitalId },
    select: { id: true, specialty: true }
  });
  if (!hospital) throw new Error("Hospital not found");

  const scope = admin.role === "hospital_admin" ? "hospital" : requestedScope ?? "hospital";
  const scopeWhere = scope === "global"
    ? { scope: "global" as const, specialty: null, hospitalId: null }
    : scope === "specialty"
      ? { scope: "specialty" as const, specialty: hospital.specialty, hospitalId: null }
      : { scope: "hospital" as const, specialty: null, hospitalId: hospital.id };
  const conflict = await findGlossaryAliasConflict({
    entryType: "transcription_hint",
    standardKo: canonical,
    spokenForms: [observed]
  }, tx);
  if (conflict) {
    throw new Error(`The observed form is already mapped to ${conflict.standardKo}`);
  }

  const scopedRows = await tx.glossaryEntry.findMany({
    where: {
      ...scopeWhere,
      isActive: true,
      entryType: { in: ["term", "transcription_hint"] }
    },
    orderBy: [{ entryType: "asc" }, { priority: "asc" }]
  });
  const canonicalKey = normalizeTranscriptionKey(canonical);
  const existing = scopedRows.find((entry) => normalizeTranscriptionKey(entry.standardKo) === canonicalKey);

  if (existing) {
    const latest = await tx.glossaryEntry.aggregate({ where: { lineageId: existing.lineageId }, _max: { version: true } });
    const entry = await tx.glossaryEntry.create({
      data: {
        scope: existing.scope,
        specialty: existing.specialty,
        hospitalId: existing.hospitalId,
        entryType: existing.entryType,
        spokenForms: uniqueSpokenForms([...existing.spokenForms, observed]),
        standardKo: existing.standardKo,
        translations: existing.translations as Prisma.InputJsonValue,
        category: existing.category,
        note: `Drafted from reviewed sample ${sample.id}`,
        priority: existing.priority,
        lineageId: existing.lineageId,
        version: (latest._max.version ?? existing.version) + 1,
        lifecycle: "draft",
        isActive: false
      }
    });
    return { entry, action: "drafted" as const };
  }

  const entry = await tx.glossaryEntry.create({
    data: {
      ...scopeWhere,
      entryType: "transcription_hint",
      spokenForms: [observed],
      standardKo: canonical,
      translations: {},
      category: category?.trim() || "sample_stt",
      note: `Promoted from reviewed sample ${sample.id}`,
      priority: 80,
      isActive: false,
      lifecycle: "draft"
    }
  });
  return { entry, action: "created" as const };
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
    sources,
    reviewKinds,
    promotionScopes
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

  try {
    const result = await prisma.$transaction(async (tx) => {
      const promotion = parsed.data.promoteToSttHint
        ? await promoteSttHint({
            tx,
            admin,
            sample: existing,
            observedForm: parsed.data.hintObservedForm ?? "",
            canonicalForm: parsed.data.hintCanonicalForm ?? "",
            requestedScope: parsed.data.promotionScope,
            category: parsed.data.hintCategory
          })
        : null;
      const status = reviewStatus(parsed.data.reviewKind, parsed.data.status, Boolean(promotion));
      const existingFlags = jsonRecord(existing.guardFlags);
      const guardFlags = parsed.data.reviewKind
        ? JSON.parse(JSON.stringify({
            ...existingFlags,
            adminReview: {
              kind: parsed.data.reviewKind,
              correctedSourceText: parsed.data.correctedSourceText?.trim() || undefined,
              note: parsed.data.reviewNote?.trim() || undefined,
              hintObservedForm: parsed.data.hintObservedForm?.trim() || undefined,
              hintCanonicalForm: parsed.data.hintCanonicalForm?.trim() || undefined,
              hintCategory: parsed.data.hintCategory?.trim() || undefined,
              promotionScope: promotion?.entry.scope ?? parsed.data.promotionScope,
              promotedGlossaryEntryId: promotion?.entry.id,
              promotionAction: promotion?.action,
              reviewedBy: { id: admin.id, name: admin.name },
              reviewedAt: new Date().toISOString()
            }
          })) as Prisma.InputJsonValue
        : undefined;

      const sample = await tx.translationSample.update({
        where: { id: parsed.data.id },
        data: {
          status,
          reviewedAt: status === "new" ? null : new Date(),
          ...(guardFlags ? { guardFlags } : {})
        },
        include: {
          hospital: { select: { id: true, name: true, slug: true } },
          staff: { select: { id: true, name: true, email: true } }
        }
      });
      return { sample, promotion };
    });

    if (result.promotion) clearGlossaryCache();
    return NextResponse.json({
      sample: sampleResponse(result.sample),
      promotion: result.promotion
        ? { entryId: result.promotion.entry.id, action: result.promotion.action, scope: result.promotion.entry.scope }
        : null
    });
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : "Sample review failed";
    const status = message.includes("already mapped") ? 409 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
