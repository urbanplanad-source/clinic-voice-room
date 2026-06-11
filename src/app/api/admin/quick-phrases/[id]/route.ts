import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentStaff } from "@/lib/session";
import { quickPhraseStages, translateQuickPhraseForAllLanguages } from "@/lib/quick-phrases";

const schema = z.object({
  hospitalId: z.string().optional(),
  stage: z.enum(quickPhraseStages).nullable().optional(),
  ko: z.string().trim().min(1).max(1000).optional(),
  translations: z.record(z.string().trim().max(2000)).optional(),
  sortOrder: z.coerce.number().int().min(0).max(100000).optional(),
  isActive: z.boolean().optional()
});

async function requireQuickPhraseAdmin() {
  const staff = await getCurrentStaff();
  if (!staff || staff.role === "staff") return null;
  return staff;
}

function jsonObject(value: Prisma.JsonValue) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, string>;
}

async function loadAuthorizedPhrase(id: string, admin: NonNullable<Awaited<ReturnType<typeof getCurrentStaff>>>) {
  const phrase = await prisma.hospitalQuickPhrase.findUnique({
    where: { id },
    include: { hospital: { select: { id: true, specialty: true } } }
  });
  if (!phrase) return null;
  if (admin.role === "hospital_admin" && phrase.hospitalId !== admin.hospitalId) return null;
  return phrase;
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const admin = await requireQuickPhraseAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  const { id } = await context.params;
  const existing = await loadAuthorizedPhrase(id, admin);
  if (!existing) return NextResponse.json({ error: "Quick phrase not found" }, { status: 404 });

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid quick phrase update payload" }, { status: 400 });
  }

  const nextHospitalId = admin.role === "hospital_admin" ? admin.hospitalId : parsed.data.hospitalId ?? existing.hospitalId;
  const nextKo = parsed.data.ko ?? existing.ko;
  let translations: Prisma.InputJsonObject | undefined;
  if (parsed.data.ko !== undefined || parsed.data.translations !== undefined || nextHospitalId !== existing.hospitalId) {
    const hospital = await prisma.hospital.findUnique({ where: { id: nextHospitalId }, select: { id: true, specialty: true } });
    if (!hospital) return NextResponse.json({ error: "Hospital not found" }, { status: 404 });
    translations = await translateQuickPhraseForAllLanguages({
      hospitalId: hospital.id,
      specialty: hospital.specialty,
      ko: nextKo,
      manualTranslations: parsed.data.translations ?? jsonObject(existing.translations)
    });
  }

  const phrase = await prisma.hospitalQuickPhrase.update({
    where: { id },
    data: {
      hospitalId: nextHospitalId,
      ...("stage" in parsed.data ? { stage: parsed.data.stage ?? null } : {}),
      ...("ko" in parsed.data ? { ko: nextKo } : {}),
      ...(translations ? { translations } : {}),
      ...("sortOrder" in parsed.data ? { sortOrder: parsed.data.sortOrder } : {}),
      ...("isActive" in parsed.data ? { isActive: parsed.data.isActive } : {})
    },
    include: { hospital: { select: { id: true, name: true, slug: true } } }
  });

  return NextResponse.json({
    phrase: {
      ...phrase,
      translations: jsonObject(phrase.translations),
      createdAt: phrase.createdAt.toISOString(),
      updatedAt: phrase.updatedAt.toISOString()
    }
  });
}

export async function DELETE(_: Request, context: { params: Promise<{ id: string }> }) {
  const admin = await requireQuickPhraseAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  const { id } = await context.params;
  const existing = await loadAuthorizedPhrase(id, admin);
  if (!existing) return NextResponse.json({ error: "Quick phrase not found" }, { status: 404 });

  const phrase = await prisma.hospitalQuickPhrase.update({
    where: { id },
    data: { isActive: false }
  });
  return NextResponse.json({ phrase: { ...phrase, translations: jsonObject(phrase.translations) } });
}
