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
const csvColumns = ["entryType", "scope", "specialty", "hospitalId", "standardKo", "spokenForms", ...translationKeys, "category", "note", "priority", "isActive"];

const glossaryPayloadSchema = z.object({
  scope: z.enum(glossaryScopes),
  specialty: z.enum(hospitalSpecialties).nullable().optional(),
  hospitalId: z.string().nullable().optional(),
  entryType: z.enum(glossaryEntryTypes).default("term"),
  spokenForms: z.array(z.string().trim().min(1).max(200)).default([]),
  standardKo: z.string().trim().min(1).max(400),
  translations: z.record(z.string().trim().max(2000)).default({}),
  category: z.string().trim().max(120).nullable().optional(),
  note: z.string().trim().max(500).nullable().optional(),
  priority: z.coerce.number().int().min(0).max(100000).default(100),
  isActive: z.boolean().optional().default(true)
});

type GlossaryAdmin = NonNullable<Awaited<ReturnType<typeof getCurrentStaff>>>;
type GlossaryPayload = z.infer<typeof glossaryPayloadSchema>;

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

function normalizePayloadForRole(payload: GlossaryPayload, admin: GlossaryAdmin) {
  if (admin.role === "hospital_admin") {
    return {
      ...payload,
      scope: "hospital" as const,
      specialty: null,
      hospitalId: admin.hospitalId,
      translations: normalizeTranslations(payload.translations)
    };
  }

  return {
    ...payload,
    specialty: payload.scope === "specialty" ? payload.specialty ?? "dermatology" : null,
    hospitalId: payload.scope === "hospital" ? payload.hospitalId ?? null : null,
    translations: normalizeTranslations(payload.translations)
  };
}

function glossaryWhereFromRequest(request: Request, admin: GlossaryAdmin): Prisma.GlossaryEntryWhereInput {
  const url = new URL(request.url);
  const scope = url.searchParams.get("scope");
  const specialty = url.searchParams.get("specialty");
  const hospitalId = url.searchParams.get("hospitalId");
  const entryType = url.searchParams.get("entryType");
  const category = url.searchParams.get("category");
  const query = url.searchParams.get("q")?.trim();

  const where: Prisma.GlossaryEntryWhereInput = {};
  if (admin.role === "hospital_admin") {
    where.scope = "hospital";
    where.hospitalId = admin.hospitalId;
  } else {
    if (scope && glossaryScopes.includes(scope as (typeof glossaryScopes)[number])) where.scope = scope as Prisma.EnumGlossaryScopeFilter["equals"];
    if (specialty && hospitalSpecialties.includes(specialty as (typeof hospitalSpecialties)[number])) {
      where.specialty = specialty as Prisma.EnumHospitalSpecialtyNullableFilter["equals"];
    }
    if (hospitalId) where.hospitalId = hospitalId;
  }

  if (entryType && glossaryEntryTypes.includes(entryType as (typeof glossaryEntryTypes)[number])) {
    where.entryType = entryType as Prisma.EnumGlossaryEntryTypeFilter["equals"];
  }
  if (category) where.category = category;
  if (query) {
    where.OR = [
      { standardKo: { contains: query, mode: "insensitive" } },
      { spokenForms: { has: query } }
    ];
  }

  return where;
}

function csvEscape(value: unknown) {
  const text = value === null || value === undefined ? "" : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function parseCsv(text: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];
    if (quoted) {
      if (char === '"' && next === '"') {
        field += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (char !== "\r") {
      field += char;
    }
  }

  row.push(field);
  if (row.some((value) => value.length > 0)) rows.push(row);
  return rows;
}

function payloadFromCsvRow(headers: string[], row: string[]) {
  const values = Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ""]));
  const translations = Object.fromEntries(translationKeys.map((key) => [key, values[key] ?? ""]));
  return glossaryPayloadSchema.parse({
    entryType: values.entryType || "term",
    scope: values.scope || "hospital",
    specialty: values.specialty || null,
    hospitalId: values.hospitalId || null,
    standardKo: values.standardKo,
    spokenForms: values.spokenForms ? values.spokenForms.split("|").map((value) => value.trim()).filter(Boolean) : [],
    translations,
    category: values.category || null,
    note: values.note || null,
    priority: values.priority || 100,
    isActive: values.isActive ? values.isActive.toLowerCase() !== "false" : true
  });
}

function entryToCsvRow(entry: {
  scope: string;
  specialty: string | null;
  hospitalId: string | null;
  entryType: string;
  spokenForms: string[];
  standardKo: string;
  translations: Prisma.JsonValue;
  category: string | null;
  note: string | null;
  priority: number;
  isActive: boolean;
}) {
  const translations = entry.translations && typeof entry.translations === "object" && !Array.isArray(entry.translations) ? entry.translations as Record<string, unknown> : {};
  return csvColumns.map((column) => {
    if (column === "spokenForms") return csvEscape(entry.spokenForms.join("|"));
    if (column in translations) return csvEscape(translations[column]);
    return csvEscape(entry[column as keyof typeof entry]);
  }).join(",");
}

async function upsertCsvEntry(database: Prisma.TransactionClient, payload: GlossaryPayload, admin: GlossaryAdmin) {
  const data = normalizePayloadForRole(payload, admin);
  const existing = await database.glossaryEntry.findFirst({
    where: {
      lifecycle: "draft",
      scope: data.scope,
      entryType: data.entryType,
      standardKo: data.standardKo,
      category: data.category ?? null,
      note: data.note ?? null,
      spokenForms: { equals: data.spokenForms }
    },
    select: { id: true }
  });
  const conflict = await findGlossaryAliasConflict({
    entryType: data.entryType,
    standardKo: data.standardKo,
    spokenForms: data.spokenForms,
    excludeId: existing?.id
  }, database);
  if (conflict) throw new Error(`${conflict.spokenForm} is already mapped to ${conflict.standardKo}`);

  if (existing) {
    await database.glossaryEntry.update({ where: { id: existing.id }, data: { ...data, isActive: false } });
    return "updated" as const;
  }

  await database.glossaryEntry.create({ data: { ...data, isActive: false, lifecycle: "draft" } });
  return "created" as const;
}

export async function GET(request: Request) {
  const admin = await requireGlossaryAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  const where = glossaryWhereFromRequest(request, admin);
  const entries = await prisma.glossaryEntry.findMany({
    where,
    orderBy: [{ priority: "asc" }, { updatedAt: "desc" }],
    include: { hospital: { select: { id: true, name: true, slug: true } } },
    take: 500
  });

  const url = new URL(request.url);
  if (url.searchParams.get("format") === "csv") {
    const csv = [csvColumns.join(","), ...entries.map(entryToCsvRow)].join("\n");
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": "attachment; filename=clinic-glossary.csv"
      }
    });
  }

  const hospitals =
    admin.role === "internal_admin"
      ? await prisma.hospital.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, slug: true, specialty: true } })
      : [];

  return NextResponse.json({ entries, hospitals });
}

export async function POST(request: Request) {
  const admin = await requireGlossaryAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  const url = new URL(request.url);
  if (url.searchParams.get("format") === "csv" || request.headers.get("content-type")?.includes("text/csv")) {
    const rows = parseCsv(await request.text());
    const [headers, ...bodyRows] = rows;
    if (!headers?.length) return NextResponse.json({ error: "Invalid CSV" }, { status: 400 });
    const normalizedHeaders = headers.map((header, index) => (index === 0 ? header.replace(/^\uFEFF/, "") : header).trim());
    const nonEmptyRows = bodyRows.filter((row) => row.some((value) => value.trim().length > 0));
    if (nonEmptyRows.length > 500) {
      return NextResponse.json({ error: "CSV imports are limited to 500 rows" }, { status: 400 });
    }

    try {
      const payloads = nonEmptyRows.map((row) => payloadFromCsvRow(normalizedHeaders, row));
      const stats = await prisma.$transaction(async (transaction) => {
        const resultStats = { created: 0, updated: 0 };
        for (const payload of payloads) {
          const result = await upsertCsvEntry(transaction, payload, admin);
          resultStats[result] += 1;
        }
        return resultStats;
      }, { timeout: 30_000 });
      clearGlossaryCache();
      return NextResponse.json({ imported: payloads.length, ...stats });
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "CSV glossary conflict";
      const status = message.includes("already mapped") ? 409 : 400;
      return NextResponse.json({ error: message }, { status });
    }
  }

  const parsed = glossaryPayloadSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid glossary payload" }, { status: 400 });
  }

  const data = normalizePayloadForRole(parsed.data, admin);
  if (data.scope === "hospital" && !data.hospitalId) {
    return NextResponse.json({ error: "hospitalId is required for hospital scope" }, { status: 400 });
  }
  const conflict = await findGlossaryAliasConflict({
    entryType: data.entryType,
    standardKo: data.standardKo,
    spokenForms: data.spokenForms
  });
  if (conflict) {
    return NextResponse.json({
      error: `${conflict.spokenForm} is already mapped to ${conflict.standardKo}`,
      conflict
    }, { status: 409 });
  }

  const entry = await prisma.glossaryEntry.create({
    data: { ...data, isActive: false, lifecycle: "draft" }
  });
  clearGlossaryCache(data.hospitalId, data.specialty);
  return NextResponse.json({ entry });
}
