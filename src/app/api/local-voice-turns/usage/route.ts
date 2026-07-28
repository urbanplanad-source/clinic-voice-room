import { NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { getCurrentStaff } from "@/lib/session";
import { clientIp, rateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { isPatientLanguage, type PatientLanguage } from "@/lib/languages";
import {
  recordLocalInterpreterUsageTurn,
  type LocalInterpreterDirection,
  type LocalInterpreterTransport
} from "@/lib/local-interpreter-usage";
import { prisma } from "@/lib/prisma";
import { recordTranslationSample, stableTranslationSampleMessageId } from "@/lib/translation-samples";

const hybridObservationSchema = z.object({
  mode: z.enum(["off", "shadow", "low_risk_main"]),
  available: z.boolean(),
  selected: z.boolean(),
  settled: z.boolean(),
  sourceTranscriptComplete: z.boolean(),
  outputTranscriptComplete: z.boolean(),
  firstOutputMs: z.number().min(0).max(120_000).nullable(),
  completedMs: z.number().min(0).max(120_000).nullable(),
  sourceText: z.string().max(10_000),
  translatedText: z.string().max(10_000),
  lowRisk: z.boolean(),
  riskReasons: z.array(z.string().min(1).max(120)).max(32),
  error: z.string().max(500).nullable()
});

const schema = z.object({
  patientLanguage: z.custom<PatientLanguage>((value) => isPatientLanguage(value)),
  direction: z.enum(["ko_to_patient", "patient_to_ko"]),
  transport: z.enum(["realtime", "upload"]).default("realtime"),
  durationSeconds: z.number().min(0).max(60 * 30).default(0),
  sourceTextCharacters: z.number().min(0).max(100_000).optional(),
  translatedTextCharacters: z.number().min(0).max(100_000).optional(),
  sourceText: z.string().trim().min(1).max(10_000).optional(),
  translatedText: z.string().trim().min(1).max(10_000).optional(),
  sourceTranscriptComplete: z.boolean().optional().default(true),
  recordSample: z.boolean().optional().default(true),
  model: z.string().trim().min(1).max(120).optional(),
  hybridObservation: hybridObservationSchema.optional()
});

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid local usage event" }, { status: 400 });
  }

  const staff = await getCurrentStaff();
  if (!staff) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limited = await rateLimit({
    key: `local-usage:${clientIp(request)}:${staff.id}:${parsed.data.patientLanguage}:${parsed.data.direction}`,
    limit: 60,
    windowMs: 60 * 1000
  });
  if (!limited.ok) {
    return rateLimitResponse(limited.retryAfter);
  }

  await recordLocalInterpreterUsageTurn({
    staff,
    patientLanguage: parsed.data.patientLanguage,
    direction: parsed.data.direction as LocalInterpreterDirection,
    transport: parsed.data.transport as LocalInterpreterTransport,
    durationSeconds: parsed.data.durationSeconds,
    sourceTextCharacters: parsed.data.sourceTextCharacters,
    translatedTextCharacters: parsed.data.translatedTextCharacters
  });

  if (parsed.data.recordSample && parsed.data.sourceText && parsed.data.translatedText) {
    const sourceLanguage = parsed.data.direction === "ko_to_patient" ? "ko" : parsed.data.patientLanguage;
    const targetLanguage = parsed.data.direction === "ko_to_patient" ? parsed.data.patientLanguage : "ko";
    const sampleMessageId = stableTranslationSampleMessageId({
      source: "local_voice",
      mode: "local",
      direction: parsed.data.direction,
      patientLanguage: parsed.data.patientLanguage,
      sourceText: parsed.data.sourceText,
      translatedText: parsed.data.translatedText,
      sourceLanguage,
      targetLanguage
    });


    await recordTranslationSample({
      hospitalId: staff.hospitalId,
      staffId: staff.id,
      messageId: sampleMessageId,
      source: "local_voice",
      mode: "local",
      direction: parsed.data.direction,
      patientLanguage: parsed.data.patientLanguage,
      sourceText: parsed.data.sourceText,
      translatedText: parsed.data.translatedText,
      sourceLanguage,
      targetLanguage,
      model: parsed.data.model ?? `${parsed.data.transport}-local`,
      sourceTranscriptComplete: parsed.data.sourceTranscriptComplete,
      guardFlags: parsed.data.hybridObservation
        ? { hybrid: parsed.data.hybridObservation }
        : undefined
    }).then(async () => {
      if (!parsed.data.hybridObservation) return;
      const existing = await prisma.translationSample.findFirst({
        where: {
          hospitalId: staff.hospitalId,
          source: "local_voice",
          messageId: sampleMessageId
        },
        select: { id: true, guardFlags: true }
      });
      if (!existing) return;
      const existingFlags = existing.guardFlags &&
        typeof existing.guardFlags === "object" &&
        !Array.isArray(existing.guardFlags)
        ? existing.guardFlags as Prisma.JsonObject
        : {};
      await prisma.translationSample.update({
        where: { id: existing.id },
        data: {
          guardFlags: {
            ...existingFlags,
            hybrid: parsed.data.hybridObservation
          } as Prisma.InputJsonObject
        }
      });
    }).catch((caught) => {
      console.error("[local-voice-turns usage sample]", caught);
    });
  }

  return NextResponse.json({ ok: true });
}
