import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentStaff } from "@/lib/session";
import { patientLanguages } from "@/lib/languages";
import { quickPhraseStages, translateQuickPhraseForAllLanguages } from "@/lib/quick-phrases";

const schema = z.object({
  hospitalId: z.string().optional(),
  stage: z.enum(quickPhraseStages).nullable().optional(),
  ko: z.string().trim().min(1).max(1000),
  translations: z.record(z.string().trim().max(2000)).default({}),
  sortOrder: z.coerce.number().int().min(0).max(100000).default(100),
  isActive: z.boolean().default(true)
});

async function requireQuickPhraseAdmin() {
  const staff = await getCurrentStaff();
  if (!staff || staff.role === "staff") return null;
  return staff;
}

function jsonObject(value: Prisma.JsonValue) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function quickPhraseResponse(phrase: {
  id: string;
  hospitalId: string;
  hospital?: { id: string; name: string; slug: string } | null;
  stage: string | null;
  ko: string;
  translations: Prisma.JsonValue;
  sortOrder: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    ...phrase,
    translations: jsonObject(phrase.translations),
    createdAt: phrase.createdAt.toISOString(),
    updatedAt: phrase.updatedAt.toISOString()
  };
}

export async function GET(request: Request) {
  const admin = await requireQuickPhraseAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  const url = new URL(request.url);
  const requestedHospitalId = url.searchParams.get("hospitalId") || undefined;
  const hospitalId = admin.role === "hospital_admin" ? admin.hospitalId : requestedHospitalId;
  const stage = url.searchParams.get("stage") || undefined;

  const phrases = await prisma.hospitalQuickPhrase.findMany({
    where: {
      ...(hospitalId ? { hospitalId } : {}),
      ...(stage ? { OR: [{ stage }, { stage: null }] } : {})
    },
    orderBy: [{ sortOrder: "asc" }, { updatedAt: "desc" }],
    include: { hospital: { select: { id: true, name: true, slug: true } } },
    take: 500
  });

  const hospitals =
    admin.role === "internal_admin"
      ? await prisma.hospital.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, slug: true, specialty: true } })
      : [];

  return NextResponse.json({ phrases: phrases.map(quickPhraseResponse), hospitals, patientLanguages });
}

export async function POST(request: Request) {
  const admin = await requireQuickPhraseAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid quick phrase payload" }, { status: 400 });
  }

  const hospitalId = admin.role === "hospital_admin" ? admin.hospitalId : parsed.data.hospitalId;
  if (!hospitalId) {
    return NextResponse.json({ error: "hospitalId is required" }, { status: 400 });
  }

  const hospital = await prisma.hospital.findUnique({
    where: { id: hospitalId },
    select: { id: true, specialty: true }
  });
  if (!hospital) return NextResponse.json({ error: "Hospital not found" }, { status: 404 });

  const translations = await translateQuickPhraseForAllLanguages({
    hospitalId: hospital.id,
    specialty: hospital.specialty,
    ko: parsed.data.ko,
    manualTranslations: parsed.data.translations
  });

  const phrase = await prisma.hospitalQuickPhrase.create({
    data: {
      hospitalId,
      stage: parsed.data.stage ?? null,
      ko: parsed.data.ko,
      translations,
      sortOrder: parsed.data.sortOrder,
      isActive: parsed.data.isActive
    },
    include: { hospital: { select: { id: true, name: true, slug: true } } }
  });

  return NextResponse.json({ phrase: quickPhraseResponse(phrase) });
}
