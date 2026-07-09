import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentStaff } from "@/lib/session";

const statuses = ["new", "reviewed", "fixed", "dismissed"] as const;
const sources = ["local_voice", "consultation_voice", "procedure_voice"] as const;

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

export async function GET(request: Request) {
  const admin = await requireSampleAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  const where = sampleWhereFromRequest(request, admin);
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