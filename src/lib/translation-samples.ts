import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { PatientLanguage } from "@/lib/languages";

const DEFAULT_TRANSLATION_SAMPLE_RETENTION_DAYS = 30;
const MAX_TRANSLATION_SAMPLE_RETENTION_DAYS = 3650;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

type TranslationSampleSource = "local_voice" | "consultation_voice" | "procedure_voice";
type TranslationSampleMode = "local" | "consultation" | "procedure";

type RecordTranslationSampleParams = {
  hospitalId: string;
  staffId?: string | null;
  roomId?: string | null;
  messageId?: string | null;
  source: TranslationSampleSource;
  mode: TranslationSampleMode;
  direction: string;
  patientLanguage?: PatientLanguage | null;
  sourceText: string;
  translatedText: string;
  sourceLanguage: string;
  targetLanguage: string;
  model?: string | null;
  guardFlags?: unknown;
  sourceTranscriptComplete?: boolean;
};

type StableTranslationSampleMessageIdParams = {
  source: TranslationSampleSource;
  mode: TranslationSampleMode;
  direction: string;
  patientLanguage?: PatientLanguage | null;
  sourceText: string;
  translatedText: string;
  sourceLanguage: string;
  targetLanguage: string;
};

function normalizeRetentionDays(value: unknown) {
  const numericValue = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numericValue) || numericValue <= 0) return DEFAULT_TRANSLATION_SAMPLE_RETENTION_DAYS;
  return Math.min(Math.floor(numericValue), MAX_TRANSLATION_SAMPLE_RETENTION_DAYS);
}

export function getTranslationSampleRetentionDays() {
  return normalizeRetentionDays(process.env.TRANSLATION_SAMPLE_RETENTION_DAYS);
}

export function getTranslationSampleRetentionCutoff(now = new Date(), retentionDays = getTranslationSampleRetentionDays()) {
  return new Date(now.getTime() - normalizeRetentionDays(retentionDays) * MS_PER_DAY);
}

export function stableTranslationSampleMessageId(params: StableTranslationSampleMessageIdParams) {
  const digest = createHash("sha256")
    .update(
      [
        params.source,
        params.mode,
        params.direction,
        params.patientLanguage ?? "",
        params.sourceLanguage,
        params.targetLanguage,
        params.sourceText.trim().replace(/\s+/g, " "),
        params.translatedText.trim().replace(/\s+/g, " ")
      ].join("\u001f")
    )
    .digest("hex")
    .slice(0, 48);

  return `sample-${digest}`;
}

function jsonValueOrUndefined(value: unknown) {
  if (value == null) return undefined;
  const serialized = JSON.stringify(value);
  if (!serialized) return undefined;
  return JSON.parse(serialized) as Prisma.InputJsonValue;
}

export async function recordTranslationSample(params: RecordTranslationSampleParams) {
  const sourceText = params.sourceText.trim();
  const translatedText = params.translatedText.trim();
  if (!sourceText || !translatedText || params.sourceTranscriptComplete === false) return null;

  try {
    return await prisma.translationSample.create({
      data: {
        hospitalId: params.hospitalId,
        staffId: params.staffId ?? undefined,
        roomId: params.roomId ?? undefined,
        messageId: params.messageId ?? undefined,
        source: params.source,
        mode: params.mode,
        direction: params.direction,
        patientLanguage: params.patientLanguage ?? undefined,
        sourceText,
        translatedText,
        sourceLanguage: params.sourceLanguage,
        targetLanguage: params.targetLanguage,
        model: params.model ?? undefined,
        guardFlags: jsonValueOrUndefined(params.guardFlags)
      }
    });
  } catch (caught) {
    if (caught instanceof Prisma.PrismaClientKnownRequestError && caught.code === "P2002") {
      return null;
    }
    throw caught;
  }
}
export async function deleteExpiredTranslationSamples(options: { now?: Date; retentionDays?: number } = {}) {
  const now = options.now ?? new Date();
  const retentionDays = normalizeRetentionDays(options.retentionDays ?? process.env.TRANSLATION_SAMPLE_RETENTION_DAYS);
  const cutoff = getTranslationSampleRetentionCutoff(now, retentionDays);
  const result = await prisma.translationSample.deleteMany({
    where: { createdAt: { lt: cutoff } }
  });

  return { deletedCount: result.count, cutoff, retentionDays };
}
