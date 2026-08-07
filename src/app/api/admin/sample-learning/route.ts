import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { normalizeTranscriptionKey } from "@/lib/clinic-transcription";
import { clearGlossaryCache, findGlossaryAliasConflict } from "@/lib/glossary-service";
import { prisma } from "@/lib/prisma";
import { getCurrentStaff } from "@/lib/session";

const reviewKinds = ["source_correct", "stt_error", "translation_error", "noise", "uncertain"] as const;
const assetTypes = ["none", "transcription_hint", "term", "verified_sentence"] as const;
const promotionScopes = ["hospital", "specialty", "global"] as const;
const supportedLanguages = new Set(["zh", "zh_tw", "yue", "ja", "en", "ru", "vi", "id", "th", "ms", "tl", "mn", "fr", "es", "de", "it", "pt"]);

const payloadSchema = z.object({
  id: z.string().min(1),
  reviewKind: z.enum(reviewKinds),
  correctedSourceText: z.string().trim().max(1000).optional(),
  correctedTranslatedText: z.string().trim().max(1000).optional(),
  reviewNote: z.string().trim().max(500).optional(),
  assetType: z.enum(assetTypes).default("none"),
  assetStandardKo: z.string().trim().max(500).optional(),
  assetSpokenForm: z.string().trim().max(200).optional(),
  assetTranslation: z.string().trim().max(1000).optional(),
  assetCategory: z.string().trim().max(120).optional(),
  promotionScope: z.enum(promotionScopes).optional()
}).superRefine((value, context) => {
  if (value.assetType !== "none" && !value.assetStandardKo) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["assetStandardKo"], message: "표준 한국어가 필요합니다." });
  }
  if (value.assetType === "transcription_hint" && (!value.assetSpokenForm || value.reviewKind !== "stt_error")) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["assetSpokenForm"], message: "STT 오류와 잘못 인식된 표현이 필요합니다." });
  }
});

type QualityAdmin = NonNullable<Awaited<ReturnType<typeof getCurrentStaff>>>;
type AssetType = Exclude<(typeof assetTypes)[number], "none">;

function jsonRecord(value: Prisma.JsonValue | null) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, Prisma.JsonValue>;
}

function jsonStrings(value: Prisma.JsonValue) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value).filter((entry): entry is [string, string] => typeof entry[1] === "string" && Boolean(entry[1].trim())));
}

function uniqueSpokenForms(values: string[]) {
  const seen = new Set<string>();
  return values.map((value) => value.trim().replace(/\s+/g, " ")).filter((value) => {
    const key = normalizeTranscriptionKey(value);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function translationPatch(sample: { sourceLanguage: string; targetLanguage: string }, translatedValue: string | undefined) {
  const value = translatedValue?.trim();
  if (!value) return {};
  if (sample.sourceLanguage === "ko" && supportedLanguages.has(sample.targetLanguage)) return { [sample.targetLanguage]: value };
  if (sample.targetLanguage === "ko" && supportedLanguages.has(sample.sourceLanguage)) return { [sample.sourceLanguage]: value };
  return {};
}

async function promoteAsset({ tx, admin, sample, data }: {
  tx: Prisma.TransactionClient;
  admin: QualityAdmin;
  sample: { id: string; hospitalId: string; sourceLanguage: string; targetLanguage: string };
  data: z.infer<typeof payloadSchema>;
}) {
  if (data.assetType === "none") return null;
  if (data.assetType === "transcription_hint" && sample.sourceLanguage !== "ko") {
    throw new Error("한국어 원문 샘플만 STT 힌트로 반영할 수 있습니다.");
  }

  const hospital = await tx.hospital.findUnique({ where: { id: sample.hospitalId }, select: { id: true, specialty: true } });
  if (!hospital) throw new Error("병원을 찾을 수 없습니다.");

  const scope = admin.role === "hospital_admin" ? "hospital" : data.promotionScope ?? "hospital";
  const scopeWhere = scope === "global"
    ? { scope: "global" as const, specialty: null, hospitalId: null }
    : scope === "specialty"
      ? { scope: "specialty" as const, specialty: hospital.specialty, hospitalId: null }
      : { scope: "hospital" as const, specialty: null, hospitalId: hospital.id };
  const entryType = data.assetType as AssetType;
  const standardKo = data.assetStandardKo!.trim().replace(/\s+/g, " ");
  const spokenForms = entryType === "verified_sentence"
    ? []
    : uniqueSpokenForms([data.assetSpokenForm ?? "", entryType === "term" ? standardKo : ""]);

  if (entryType === "transcription_hint" && normalizeTranscriptionKey(spokenForms[0] ?? "") === normalizeTranscriptionKey(standardKo)) {
    throw new Error("잘못 인식된 표현과 표준 표현은 달라야 합니다.");
  }

  const conflict = await findGlossaryAliasConflict({ entryType, standardKo, spokenForms }, tx);
  if (conflict) throw new Error(`이미 '${conflict.standardKo}'에 연결된 발화형입니다.`);

  const rows = await tx.glossaryEntry.findMany({ where: { ...scopeWhere, entryType, isActive: true }, orderBy: { priority: "asc" } });
  const standardKey = normalizeTranscriptionKey(standardKo);
  const existing = rows.find((entry) => normalizeTranscriptionKey(entry.standardKo) === standardKey);
  const translations = translationPatch(sample, data.assetTranslation);

  if (existing) {
    const latest = await tx.glossaryEntry.aggregate({ where: { lineageId: existing.lineageId }, _max: { version: true } });
    const entry = await tx.glossaryEntry.create({
      data: {
        scope: existing.scope,
        specialty: existing.specialty,
        hospitalId: existing.hospitalId,
        entryType: existing.entryType,
        spokenForms: uniqueSpokenForms([...existing.spokenForms, ...spokenForms]),
        translations: { ...jsonStrings(existing.translations), ...translations },
        standardKo: existing.standardKo,
        category: existing.category || data.assetCategory?.trim() || undefined,
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
      entryType,
      spokenForms,
      standardKo,
      translations,
      category: data.assetCategory?.trim() || (entryType === "term" ? "sample_term" : entryType === "verified_sentence" ? "sample_verified" : "sample_stt"),
      note: `Promoted from reviewed sample ${sample.id}`,
      priority: entryType === "verified_sentence" ? 40 : entryType === "term" ? 60 : 80,
      isActive: false,
      lifecycle: "draft"
    }
  });
  return { entry, action: "created" as const };
}

export async function PATCH(request: Request) {
  const admin = await getCurrentStaff();
  if (!admin || admin.role === "staff") return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  const parsed = payloadSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "검수 내용을 확인해주세요." }, { status: 400 });

  const existing = await prisma.translationSample.findUnique({ where: { id: parsed.data.id } });
  if (!existing || (admin.role === "hospital_admin" && existing.hospitalId !== admin.hospitalId)) {
    return NextResponse.json({ error: "샘플을 찾을 수 없습니다." }, { status: 404 });
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const promotion = await promoteAsset({ tx, admin, sample: existing, data: parsed.data });
      const status = promotion ? "fixed" : parsed.data.reviewKind === "noise" ? "dismissed" : "reviewed";
      const previousFlags = jsonRecord(existing.guardFlags);
      const guardFlags = JSON.parse(JSON.stringify({
        ...previousFlags,
        adminReview: {
          kind: parsed.data.reviewKind,
          correctedSourceText: parsed.data.correctedSourceText?.trim() || undefined,
          correctedTranslatedText: parsed.data.correctedTranslatedText?.trim() || undefined,
          note: parsed.data.reviewNote?.trim() || undefined,
          assetType: parsed.data.assetType,
          assetStandardKo: parsed.data.assetStandardKo?.trim() || undefined,
          assetSpokenForm: parsed.data.assetSpokenForm?.trim() || undefined,
          assetTranslation: parsed.data.assetTranslation?.trim() || undefined,
          assetCategory: parsed.data.assetCategory?.trim() || undefined,
          promotionScope: promotion?.entry.scope ?? parsed.data.promotionScope,
          promotedGlossaryEntryId: promotion?.entry.id,
          promotionAction: promotion?.action,
          promotedEntryType: promotion?.entry.entryType,
          reviewedBy: { id: admin.id, name: admin.name },
          reviewedAt: new Date().toISOString()
        }
      })) as Prisma.InputJsonValue;

      const sample = await tx.translationSample.update({
        where: { id: existing.id },
        data: { status, reviewedAt: new Date(), guardFlags },
        include: {
          hospital: { select: { id: true, name: true, slug: true } },
          staff: { select: { id: true, name: true, email: true } }
        }
      });
      return { sample, promotion };
    });

    if (result.promotion) clearGlossaryCache();
    return NextResponse.json({
      sample: { ...result.sample, createdAt: result.sample.createdAt.toISOString(), reviewedAt: result.sample.reviewedAt?.toISOString() ?? null },
      promotion: result.promotion ? { entryId: result.promotion.entry.id, entryType: result.promotion.entry.entryType, standardKo: result.promotion.entry.standardKo, action: result.promotion.action, scope: result.promotion.entry.scope } : null
    });
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : "샘플 검수에 실패했습니다.";
    const status = message.includes("이미") ? 409 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
