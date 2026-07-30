import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentStaff } from "@/lib/session";
import { clearGlossaryCache, findGlossaryAliasConflict } from "@/lib/glossary-service";
import { hospitalSpecialties } from "@/lib/hospital-specialty";

const glossaryScopes = ["global", "specialty", "hospital"] as const;
const glossaryEntryTypes = ["term", "critical_phrase", "transcription_hint", "verified_sentence"] as const;
const translationKeys = ["zh", "zh_tw", "yue", "ja", "en", "ru", "vi", "id", "th", "ms", "tl", "mn", "fr", "es", "de", "it", "pt"] as const;

const updateSchema = z.object({
  scope: z.enum(glossaryScopes).optional(),
  specialty: z.enum(hospitalSpecialties).nullable().optional(),
  hospitalId: z.string().nullable().optional(),
  entryType: z.enum(glossaryEntryTypes).optional(),
  spokenForms: z.array(z.string().trim().min(1).max(200)).optional(),
  standardKo: z.string().trim().min(1).max(400).optional(),
  translations: z.record(z.string().trim().max(2000)).optional(),
  category: z.string().trim().max(120).nullable().optional(),
  note: z.string().trim().max(500).nullable().optional(),
  priority: z.coerce.number().int().min(0).max(100000).optional(),
  isActive: z.boolean().optional()
});

async function requireGlossaryAdmin() {
  const staff = await getCurrentStaff();
  if (!staff || staff.role === "staff") return null;
  return staff;
}

function normalizeTranslations(translations: Record<string, string>) {
  const normalized: Record<string, string> = {};
  for (const key of translationKeys) {
    const value = translations[key]?.trim();
    if (value) normalized[key] = value;
  }
  return normalized as Prisma.InputJsonObject;
}

async function loadAuthorizedEntry(id: string, admin: NonNullable<Awaited<ReturnType<typeof getCurrentStaff>>>) {
  const entry = await prisma.glossaryEntry.findUnique({ where: { id } });
  if (!entry) return null;
  if (admin.role === "hospital_admin" && (entry.scope !== "hospital" || entry.hospitalId !== admin.hospitalId)) return null;
  return entry;
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const admin = await requireGlossaryAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  const { id } = await context.params;
  const existing = await loadAuthorizedEntry(id, admin);
  if (!existing) return NextResponse.json({ error: "Glossary entry not found" }, { status: 404 });

  const parsed = updateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid glossary update payload" }, { status: 400 });
  }
  if (parsed.data.isActive ?? existing.isActive) {
    const conflict = await findGlossaryAliasConflict({
      entryType: parsed.data.entryType ?? existing.entryType,
      standardKo: parsed.data.standardKo ?? existing.standardKo,
      spokenForms: parsed.data.spokenForms ?? existing.spokenForms,
      excludeId: existing.id
    });
    if (conflict) {
      return NextResponse.json({
        error: `${conflict.spokenForm} is already mapped to ${conflict.standardKo}`,
        conflict
      }, { status: 409 });
    }
  }

  const data: Prisma.GlossaryEntryUpdateInput = {
    ...("entryType" in parsed.data ? { entryType: parsed.data.entryType } : {}),
    ...("spokenForms" in parsed.data ? { spokenForms: parsed.data.spokenForms ?? [] } : {}),
    ...("standardKo" in parsed.data ? { standardKo: parsed.data.standardKo } : {}),
    ...("category" in parsed.data ? { category: parsed.data.category ?? null } : {}),
    ...("note" in parsed.data ? { note: parsed.data.note ?? null } : {}),
    ...("priority" in parsed.data ? { priority: parsed.data.priority } : {}),
    ...("isActive" in parsed.data ? { isActive: parsed.data.isActive } : {}),
    ...(parsed.data.translations ? { translations: normalizeTranslations(parsed.data.translations) } : {})
  };

  if (admin.role === "hospital_admin") {
    data.scope = "hospital";
    data.specialty = null;
    data.hospital = { connect: { id: admin.hospitalId } };
  } else {
    const nextScope = parsed.data.scope ?? existing.scope;
    const nextSpecialty = nextScope === "specialty"
      ? ("specialty" in parsed.data
          ? parsed.data.specialty ?? "dermatology"
          : existing.scope === "specialty"
            ? existing.specialty ?? "dermatology"
            : "dermatology")
      : null;
    const nextHospitalId = nextScope === "hospital"
      ? ("hospitalId" in parsed.data
          ? parsed.data.hospitalId
          : existing.scope === "hospital"
            ? existing.hospitalId
            : null)
      : null;
    if (nextScope === "hospital" && !nextHospitalId) {
      return NextResponse.json({ error: "hospitalId is required for hospital scope" }, { status: 400 });
    }
    data.scope = nextScope;
    data.specialty = nextSpecialty;
    data.hospital = nextHospitalId ? { connect: { id: nextHospitalId } } : { disconnect: true };
  }

  const entry = await prisma.glossaryEntry.update({
    where: { id },
    data
  });
  clearGlossaryCache(existing.hospitalId, existing.specialty);
  clearGlossaryCache(entry.hospitalId, entry.specialty);

  return NextResponse.json({ entry });
}

export async function DELETE(_: Request, context: { params: Promise<{ id: string }> }) {
  const admin = await requireGlossaryAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  const { id } = await context.params;
  const existing = await loadAuthorizedEntry(id, admin);
  if (!existing) return NextResponse.json({ error: "Glossary entry not found" }, { status: 404 });

  const entry = await prisma.glossaryEntry.update({
    where: { id },
    data: { isActive: false }
  });
  clearGlossaryCache(entry.hospitalId, entry.specialty);

  return NextResponse.json({ entry });
}
