import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { PatientLanguage } from "@/lib/languages";

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
};

function jsonValueOrUndefined(value: unknown) {
  if (value == null) return undefined;
  const serialized = JSON.stringify(value);
  if (!serialized) return undefined;
  return JSON.parse(serialized) as Prisma.InputJsonValue;
}

export async function recordTranslationSample(params: RecordTranslationSampleParams) {
  const sourceText = params.sourceText.trim();
  const translatedText = params.translatedText.trim();
  if (!sourceText || !translatedText) return null;

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