import { after, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentStaff } from "@/lib/session";
import { clientIp, rateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { buildClinicGlossaryInstructions, buildClinicTranscriptionPrompt, normalizeClinicTranslation, type ClinicGlossaryData } from "@/lib/clinic-glossary";
import { getGlossaryForHospital } from "@/lib/glossary-service";
import { isPatientLanguage, languageLabels, sourceTargetFor, type ParticipantRole, type PatientLanguage } from "@/lib/languages";
import { normalizedTranscriptionModel } from "@/lib/openai-models";
import { isPatientRoomRequestAuthorized } from "@/lib/patient-room-session";
import { pendingBackTranslationGuard, runBackTranslationCheck } from "@/lib/back-translation-check";
import { mergeGuardFlags, parseGuardFlags, type GuardFlags } from "@/lib/guard-flags";
import { compareNumericSignatures, numberGuardEnabled } from "@/lib/number-guard";
import { translateWithOpenAITextSafety } from "@/lib/openai-text-translation";
import { matchVerifiedSentence } from "@/lib/verified-sentences";
import { resolveRealtimeVerifiedTranslation } from "@/lib/realtime-verified-translation";
import { broadcastServerTranslationMessage } from "@/lib/supabase-realtime-server";
import { recordTranslationSample } from "@/lib/translation-samples";
import { isClearlyNotKoreanTranslation } from "@/lib/translation-language-guard";
import {
  translationQualityGuardFromOutcome,
  validateMedicalTranslation
} from "@/lib/medical-semantic-validation";
import { matchedGlossaryEntryIds } from "@/lib/compiled-glossary-index";
import { recordServerTranslationQualityMetric } from "@/lib/local-interpreter-metrics";
import { resolveUploadedMedicalTranscription } from "@/lib/openai-medical-transcription-retry";

type TargetLanguage = PatientLanguage | "ko";

type TranscriptionResponse = {
  text?: string;
};

function isTranscriptionPromptCompatibilityError(detail: string) {
  return /(?:prompt.*(?:unknown|unsupported|invalid|unrecognized)|(?:unknown|unsupported|invalid|unrecognized).*prompt)/i.test(detail);
}

function isTranscriptionLanguageCompatibilityError(detail: string) {
  return /(?:language.*(?:unknown|unsupported|invalid|unrecognized)|(?:unknown|unsupported|invalid|unrecognized).*language)/i.test(detail);
}

function shouldSendTranscriptionLanguageHint(language: string) {
  return language !== "mn";
}

const realtimeMessageSchema = z.object({
  roomId: z.string(),
  roomToken: z.string().optional(),
  messageId: z.string().min(1).max(120),
  role: z.enum(["staff", "patient"]),
  patientLanguage: z.custom<PatientLanguage>((value) => isPatientLanguage(value)),
  sourceText: z.string().trim().max(4000).optional().default(""),
  translatedText: z.string().trim().min(1).max(4000),
  sourceTranscriptComplete: z.boolean().optional().default(true)
});

function textField(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function transcriptionLanguageFor(role: ParticipantRole, patientLanguage: PatientLanguage) {
  if (role === "staff") return "ko";
  if (patientLanguage === "zh_tw" || patientLanguage === "yue") return "zh";
  return patientLanguage;
}

async function translateProcedureSourceText(params: {
  roomId: string;
  role: ParticipantRole;
  patientLanguage: PatientLanguage;
  sourceText: string;
  glossaryData: ClinicGlossaryData;
}) {
  const direction = sourceTargetFor(params.role, params.patientLanguage);
  const targetLanguage: TargetLanguage = params.role === "staff" ? params.patientLanguage : "ko";
  const targetLabel = targetLanguage === "ko" ? "Korean" : languageLabels[params.patientLanguage].english;
  const verifiedMatch = matchVerifiedSentence(params.sourceText, targetLanguage, params.glossaryData);
  if (verifiedMatch) {
    return {
      translatedText: normalizeClinicTranslation(verifiedMatch.translatedText, targetLanguage, params.glossaryData),
      targetLanguage,
      model: "verified",
      guardFlags: undefined,
      translationSource: "verified" as const
    };
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return { response: NextResponse.json({ error: "OPENAI_API_KEY is not configured" }, { status: 500 }) };
  }

  const instructions = [
    "You are a professional medical interpreter for a dermatology and plastic surgery procedure room.",
    "Translate the user's short spoken procedure-room message accurately and naturally.",
    `Target language: ${targetLabel}.`,
    direction.instructions,
    "Preserve the speech act exactly: questions must remain questions, requests must remain requests, and statements must remain statements.",
    "Never answer the speaker, predict the other participant's reply, or continue the conversation.",
    "Preserve clinical meaning, urgency, numbers, body parts, and safety instructions.",
    "Do not add advice, diagnosis, consent language, labels, quotes, markdown, or commentary.",
    "Return only the translated text.",
    buildClinicGlossaryInstructions(params.patientLanguage, params.glossaryData)
  ].join("\n");

  let translation;
  try {
    translation = await translateWithOpenAITextSafety({
      apiKey,
      safetyIdentifier: `clinic-voice-room-procedure-text-${params.roomId}-${params.role}`,
      sourceText: params.sourceText,
      instructions,
      glossaryData: params.glossaryData,
      errorLabel: "[procedure-turns translation]",
      context: "procedure-turns"
    });
  } catch (caught) {
    if (caught instanceof Error && caught.message === "empty_translation") {
      return { response: NextResponse.json({ error: "No translated text was returned" }, { status: 502 }) };
    }
    return { response: NextResponse.json({ error: "Procedure turn translation failed" }, { status: 502 }) };
  }

  const normalizedText = normalizeClinicTranslation(translation.translatedText, targetLanguage, params.glossaryData);
  if (targetLanguage === "ko" && isClearlyNotKoreanTranslation(params.sourceText, normalizedText)) {
    console.error(
      "[procedure-turns translation] rejected non-Korean target",
      JSON.stringify({ roomId: params.roomId, role: params.role })
    );
    return { response: NextResponse.json({ error: "Korean translation validation failed" }, { status: 502 }) };
  }
  const guardFlags = mergeGuardFlags(
      translation.guardFlags,
      pendingBackTranslationGuard({
        sourceText: params.sourceText,
        role: params.role,
        targetLanguage,
        translationSource: "llm"
      })
    );

  return {
    translatedText: normalizedText,
    targetLanguage,
    model: translation.model,
    guardFlags,
    translationSource: "llm" as const
  };
}

async function handleRealtimeStaffMessage(request: Request) {
  const handlerStartedAt = performance.now();
  const parsed = realtimeMessageSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid procedure turn payload" }, { status: 400 });
  }

  const limited = await rateLimit({
    key: `procedure-turn-realtime:${clientIp(request)}:${parsed.data.roomId}:${parsed.data.role}`,
    limit: 30,
    windowMs: 60 * 1000
  });
  if (!limited.ok) return rateLimitResponse(limited.retryAfter);

  const room = await prisma.translationRoom.findUnique({
    where: { id: parsed.data.roomId },
    include: { hospital: { select: { specialty: true } } }
  });
  if (!room || room.status === "ended" || room.patientLanguage !== parsed.data.patientLanguage || room.roomMode !== "procedure") {
    return NextResponse.json({ error: "Room not available" }, { status: 404 });
  }

  if (parsed.data.role === "staff") {
    const staff = await getCurrentStaff();
    if (!staff || staff.id !== room.hostStaffId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  } else if (!(await isPatientRoomRequestAuthorized(room, parsed.data.roomToken))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const targetLanguage: TargetLanguage = parsed.data.role === "staff" ? parsed.data.patientLanguage : "ko";
  const glossaryData = await getGlossaryForHospital(room.hospitalId, room.hospital.specialty);
  const glossaryMatchStartedAt = performance.now();
  const matchedEntryIds = matchedGlossaryEntryIds(parsed.data.sourceText, glossaryData);
  const glossaryMatchMs = performance.now() - glossaryMatchStartedAt;
  const exactMatchStartedAt = performance.now();
  const realtimeVerified = resolveRealtimeVerifiedTranslation({
    sourceText: parsed.data.sourceText,
    sourceTranscriptComplete: parsed.data.sourceTranscriptComplete,
    targetLanguage,
    glossaryData
  });
  const exactMatchMs = performance.now() - exactMatchStartedAt;
  let normalizedText = realtimeVerified?.translatedText ??
    normalizeClinicTranslation(parsed.data.translatedText, targetLanguage, glossaryData);
  let model = realtimeVerified?.model ?? "realtime";
  let translationSource: "realtime" | "llm" | "verified" = realtimeVerified?.translationSource ?? "realtime";
  let guardFlags: GuardFlags | undefined;
  let repairedTargetLanguage = false;

  const targetLanguageMismatch =
    parsed.data.role === "patient" &&
    isClearlyNotKoreanTranslation(parsed.data.sourceText, normalizedText);

  if (targetLanguageMismatch) {
    if (!parsed.data.sourceText || !parsed.data.sourceTranscriptComplete) {
      console.warn(
        "[procedure-turns realtime target-language] blocked without complete source transcript",
        JSON.stringify({ roomId: room.id, messageId: parsed.data.messageId })
      );
      return NextResponse.json(
        { error: "Complete source transcript is required to repair the Korean translation" },
        { status: 422 }
      );
    }

    const retry = await translateProcedureSourceText({
      roomId: room.id,
      role: parsed.data.role,
      patientLanguage: parsed.data.patientLanguage,
      sourceText: parsed.data.sourceText,
      glossaryData
    });
    if (retry.response) return retry.response;

    normalizedText = retry.translatedText;
    model = retry.model;
    guardFlags = retry.guardFlags;
    translationSource = retry.translationSource;
    repairedTargetLanguage = true;
    console.warn(
      "[procedure-turns realtime target-language] repaired before persist",
      JSON.stringify({ roomId: room.id, messageId: parsed.data.messageId, model })
    );
  }

  if (translationSource !== "verified" && !repairedTargetLanguage && numberGuardEnabled() && parsed.data.sourceText && parsed.data.sourceTranscriptComplete) {
    try {
      const comparison = compareNumericSignatures(parsed.data.sourceText, parsed.data.translatedText);
      if (!comparison.ok) {
        const retry = await translateProcedureSourceText({
          roomId: room.id,
          role: parsed.data.role,
          patientLanguage: parsed.data.patientLanguage,
          sourceText: parsed.data.sourceText,
          glossaryData
        });
        if (!retry.response) {
          normalizedText = retry.translatedText;
          model = retry.model;
          guardFlags = retry.guardFlags;
          translationSource = retry.translationSource;
        }
      }
    } catch (caught) {
      console.error("[procedure-turns realtime number-guard] fail-open", caught);
    }
  } else if (numberGuardEnabled() && parsed.data.sourceText && !parsed.data.sourceTranscriptComplete) {
    console.log(
      "[procedure-turns realtime number-guard] skipped incomplete source transcript",
      JSON.stringify({ roomId: room.id, messageId: parsed.data.messageId })
    );
  }

  if (parsed.data.role === "patient" && !parsed.data.sourceTranscriptComplete) {
    return NextResponse.json(
      {
        status: "retry_required",
        error: "Complete source transcript is required for patient-to-Korean validation"
      },
      { status: 422 }
    );
  }

  const direction = parsed.data.role === "staff" ? "ko_to_patient" as const : "patient_to_ko" as const;
  const qualityOutcome = await validateMedicalTranslation({
    apiKey: process.env.OPENAI_API_KEY,
    sourceText: parsed.data.sourceText,
    translatedText: normalizedText,
    direction,
    sourceLanguage: parsed.data.role === "staff" ? "Korean" : languageLabels[parsed.data.patientLanguage].english,
    targetLanguage: parsed.data.role === "staff" ? languageLabels[parsed.data.patientLanguage].english : "Korean",
    safetyIdentifier: `clinic-voice-room-procedure-quality-${room.id}-${parsed.data.role}`,
    initialTranslationSource: translationSource === "verified" ? "verified_sentence" : "model",
    glossaryInstructions: buildClinicGlossaryInstructions(parsed.data.patientLanguage, glossaryData),
    semanticRequired: parsed.data.role === "patient",
    strictTranslate: async () => {
      const retry = await translateProcedureSourceText({
        roomId: room.id,
        role: parsed.data.role,
        patientLanguage: parsed.data.patientLanguage,
        sourceText: parsed.data.sourceText,
        glossaryData
      });
      if (retry.response) return null;
      return {
        translatedText: retry.translatedText,
        model: retry.model,
        translationSource: retry.translationSource === "verified" ? "verified_sentence" as const : "model" as const
      };
    }
  });
  if (qualityOutcome.status !== "final" || !qualityOutcome.finalTranslation) {
    console.warn("[procedure-turns quality] blocked", JSON.stringify({
      roomId: room.id,
      messageId: parsed.data.messageId,
      direction,
      semanticStatus: qualityOutcome.semanticStatus,
      failureReason: qualityOutcome.failureReason
    }));
    after(() => recordServerTranslationQualityMetric({
      eventId: `web-procedure-${parsed.data.messageId}`,
      hospitalId: room.hospitalId,
      staffId: room.hostStaffId,
      patientLanguage: parsed.data.patientLanguage,
      direction,
      outcome: "retry_prompt",
      messageId: parsed.data.messageId,
      transport: "realtime",
      exactMatchMs,
      glossaryMatchMs,
      totalMs: performance.now() - handlerStartedAt,
      packVersion: glossaryData.metadata?.packVersion,
      glossaryVersion: glossaryData.metadata?.glossaryVersion,
      normalizationVersion: glossaryData.metadata?.normalizationVersion,
      modelId: qualityOutcome.modelId ?? model,
      enginePath: "strict",
      initialDeterministicStatus: qualityOutcome.initialDeterministic.status,
      finalDeterministicStatus: qualityOutcome.finalDeterministic.status,
      semanticStatus: qualityOutcome.semanticStatus,
      validationPath: qualityOutcome.validationPath,
      validationMs: qualityOutcome.validationMs,
      correctionMs: qualityOutcome.correctionMs,
      corrected: qualityOutcome.corrected,
      verifiedSentence: qualityOutcome.translationSource === "verified_sentence",
      riskLevel: qualityOutcome.finalDeterministic.riskLevel,
      riskReasons: qualityOutcome.finalDeterministic.riskReasons,
      matchedEntryIds,
      modelAttemptCount: qualityOutcome.modelAttemptCount,
      validationAttemptCount: qualityOutcome.validationAttemptCount,
      correctionAttemptCount: qualityOutcome.correctionAttemptCount,
      strictAttemptCount: qualityOutcome.strictAttemptCount,
      errorCategory: qualityOutcome.failureReason
    }).catch((caught) => console.error("[procedure-turns quality metric]", caught)));
    return NextResponse.json(
      {
        status: "retry_required",
        error: "Translation accuracy could not be confirmed. Please speak again.",
        quality: translationQualityGuardFromOutcome(qualityOutcome)
      },
      { status: 422 }
    );
  }
  normalizedText = normalizeClinicTranslation(qualityOutcome.finalTranslation, targetLanguage, glossaryData);
  if (qualityOutcome.corrected) {
    model = qualityOutcome.modelId ?? model;
    translationSource = qualityOutcome.translationSource === "verified_sentence" ? "verified" : "llm";
  }
  guardFlags = mergeGuardFlags(guardFlags, { quality: translationQualityGuardFromOutcome(qualityOutcome) });

  guardFlags = mergeGuardFlags(
      guardFlags,
      pendingBackTranslationGuard({
        sourceText: parsed.data.sourceText,
        role: parsed.data.role,
        targetLanguage,
        translationSource
      })
    );

  let savedMessage;
  try {
    savedMessage = await prisma.$transaction(async (tx) => {
      await tx.translationRoom.updateMany({
        where: { id: room.id, status: { not: "ended" } },
        data: { lastActiveAt: new Date() }
      });

      return tx.consultationMessage.create({
        data: {
          id: parsed.data.messageId,
          roomId: room.id,
          speaker: parsed.data.role,
          sourceText: parsed.data.sourceText || null,
          text: normalizedText,
          targetLanguage,
          guardFlags: guardFlags ? guardFlags as Prisma.InputJsonObject : undefined
        }
      });
    });
  } catch (caught) {
    if (caught instanceof Prisma.PrismaClientKnownRequestError && caught.code === "P2002") {
      savedMessage = await prisma.consultationMessage.findFirst({
        where: {
          id: parsed.data.messageId,
          roomId: room.id,
          speaker: parsed.data.role
        }
      });
      if (!savedMessage) throw caught;
    } else {
      throw caught;
    }
  }

  if (guardFlags?.backTranslation?.status === "pending") {
    after(() =>
      runBackTranslationCheck({
        roomId: room.id,
        messageId: savedMessage.id,
        sourceText: parsed.data.sourceText,
        translatedText: savedMessage.text,
        patientLanguage: parsed.data.patientLanguage
      })
    );
  }

  const messageGuardFlags = parseGuardFlags(savedMessage.guardFlags) ?? undefined;
  const messageTargetLanguage = (savedMessage.targetLanguage ?? undefined) as TargetLanguage | undefined;
  after(() =>
    recordTranslationSample({
      hospitalId: room.hospitalId,
      staffId: room.hostStaffId,
      roomId: room.id,
      messageId: savedMessage.id,
      source: "procedure_voice",
      mode: "procedure",
      direction: parsed.data.role === "staff" ? "ko_to_patient" : "patient_to_ko",
      patientLanguage: parsed.data.patientLanguage,
      sourceText: savedMessage.sourceText ?? parsed.data.sourceText,
      translatedText: savedMessage.text,
      sourceLanguage: parsed.data.role === "staff" ? "ko" : parsed.data.patientLanguage,
      targetLanguage,
      model,
      guardFlags: messageGuardFlags,
      sourceTranscriptComplete: parsed.data.sourceTranscriptComplete
    }).catch((caught) => {
      console.error("[procedure-turns realtime sample]", caught);
    })
  );
  after(() =>
    broadcastServerTranslationMessage(room.id, {
      id: savedMessage.id,
      speaker: savedMessage.speaker,
      sourceText: savedMessage.sourceText ?? undefined,
      text: savedMessage.text,
      targetLanguage: messageTargetLanguage,
      createdAt: savedMessage.createdAt.toISOString(),
      readAt: savedMessage.readAt?.toISOString() ?? null,
      guardFlags: messageGuardFlags
    }).catch((caught) => {
      console.error("[procedure-turns realtime broadcast]", caught);
    })
  );
  after(() => recordServerTranslationQualityMetric({
    eventId: `web-procedure-${savedMessage.id}`,
    hospitalId: room.hospitalId,
    staffId: room.hostStaffId,
    patientLanguage: parsed.data.patientLanguage,
    direction,
    outcome: "success",
    messageId: savedMessage.id,
    transport: "realtime",
    exactMatchMs,
    glossaryMatchMs,
    totalMs: performance.now() - handlerStartedAt,
    packVersion: glossaryData.metadata?.packVersion,
    glossaryVersion: glossaryData.metadata?.glossaryVersion,
    normalizationVersion: glossaryData.metadata?.normalizationVersion,
    modelId: qualityOutcome.modelId ?? model,
    enginePath: qualityOutcome.validationPath === "strict" ? "strict" : "realtime",
    initialDeterministicStatus: qualityOutcome.initialDeterministic.status,
    finalDeterministicStatus: qualityOutcome.finalDeterministic.status,
    semanticStatus: qualityOutcome.semanticStatus,
    validationPath: qualityOutcome.validationPath,
    validationMs: qualityOutcome.validationMs,
    correctionMs: qualityOutcome.correctionMs,
    corrected: qualityOutcome.corrected,
    verifiedSentence: qualityOutcome.translationSource === "verified_sentence",
    riskLevel: qualityOutcome.finalDeterministic.riskLevel,
    riskReasons: qualityOutcome.finalDeterministic.riskReasons,
    matchedEntryIds,
    modelAttemptCount: qualityOutcome.modelAttemptCount,
    validationAttemptCount: qualityOutcome.validationAttemptCount,
    correctionAttemptCount: qualityOutcome.correctionAttemptCount,
    strictAttemptCount: qualityOutcome.strictAttemptCount
  }).catch((caught) => console.error("[procedure-turns quality metric]", caught)));

  return NextResponse.json({
    message: {
      id: savedMessage.id,
      speaker: savedMessage.speaker,
      sourceText: savedMessage.sourceText ?? undefined,
      text: savedMessage.text,
      targetLanguage: savedMessage.targetLanguage ?? undefined,
      createdAt: savedMessage.createdAt.toISOString(),
      readAt: savedMessage.readAt?.toISOString() ?? null,
      guardFlags: messageGuardFlags ?? null
    },
    sourceText: savedMessage.sourceText ?? "",
    translatedText: savedMessage.text,
    finalTranslation: savedMessage.text,
    status: "final",
    model,
    translationQuality: messageGuardFlags?.quality ?? null,
    translationResult: {
      turnId: parsed.data.messageId,
      status: "final",
      finalTranslation: savedMessage.text,
      translationSource: qualityOutcome.translationSource,
      enginePath: qualityOutcome.validationPath === "strict" ? "strict" : "realtime",
      modelId: model,
      glossaryVersion: glossaryData.metadata?.glossaryVersion ?? "legacy",
      packVersion: glossaryData.metadata?.packVersion ?? "legacy",
      normalizationVersion: glossaryData.metadata?.normalizationVersion ?? 1,
      matchedEntryIds,
      riskLevel: qualityOutcome.finalDeterministic.riskLevel,
      riskReasons: qualityOutcome.finalDeterministic.riskReasons,
      initialDeterministicStatus: qualityOutcome.initialDeterministic.status,
      finalDeterministicStatus: qualityOutcome.finalDeterministic.status,
      semanticStatus: qualityOutcome.semanticStatus,
      corrected: qualityOutcome.corrected,
      validationPath: qualityOutcome.validationPath,
      latency: {
        serverGlossaryMs: exactMatchMs + glossaryMatchMs,
        serverValidationMs: qualityOutcome.validationMs,
        serverCorrectionMs: qualityOutcome.correctionMs
      }
    }
  });
}

async function handleAudioTurn(request: Request) {
  const startedAt = Date.now();
  let transcriptionMs = 0;
  let translationMs = 0;
  let persistMs = 0;
  const formData = await request.formData().catch(() => null);
  if (!formData) {
    return NextResponse.json({ error: "Invalid procedure turn payload" }, { status: 400 });
  }

  const roomId = textField(formData, "roomId");
  const roomToken = textField(formData, "roomToken");
  const clientTurnId = textField(formData, "clientTurnId");
  const role = textField(formData, "role") as ParticipantRole;
  const patientLanguage = textField(formData, "patientLanguage");
  const audio = formData.get("audio");

  if (!roomId || !clientTurnId || clientTurnId.length > 120 || (role !== "staff" && role !== "patient") || !isPatientLanguage(patientLanguage) || !(audio instanceof File)) {
    return NextResponse.json({ error: "Invalid procedure turn payload" }, { status: 400 });
  }

  if (audio.size <= 0 || audio.size > 15 * 1024 * 1024) {
    return NextResponse.json({ error: "Audio turn is empty or too large" }, { status: 413 });
  }

  const limited = await rateLimit({
    key: `procedure-turn:${clientIp(request)}:${roomId}:${role}`,
    limit: 30,
    windowMs: 60 * 1000
  });
  if (!limited.ok) {
    return rateLimitResponse(limited.retryAfter);
  }

  const room = await prisma.translationRoom.findUnique({
    where: { id: roomId },
    include: { hospital: { select: { specialty: true } } }
  });
  if (!room || room.status === "ended" || room.patientLanguage !== patientLanguage || room.roomMode !== "procedure") {
    return NextResponse.json({ error: "Room not available" }, { status: 404 });
  }

  if (role === "staff") {
    const staff = await getCurrentStaff();
    if (!staff || staff.id !== room.hostStaffId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  } else if (!(await isPatientRoomRequestAuthorized(room, roomToken))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const messageId = `${role}-procedure-${clientTurnId}`;
  const existingMessage = await prisma.consultationMessage.findFirst({
    where: { id: messageId, roomId: room.id, speaker: role }
  });
  if (existingMessage) {
    return NextResponse.json({
      message: {
        id: existingMessage.id,
        speaker: existingMessage.speaker,
        sourceText: existingMessage.sourceText ?? undefined,
        text: existingMessage.text,
        targetLanguage: existingMessage.targetLanguage ?? undefined,
        createdAt: existingMessage.createdAt.toISOString(),
        readAt: existingMessage.readAt?.toISOString() ?? null,
        guardFlags: parseGuardFlags(existingMessage.guardFlags) ?? null
      },
      sourceText: existingMessage.sourceText ?? "",
      translatedText: existingMessage.text,
      model: "cached"
    });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "OPENAI_API_KEY is not configured" }, { status: 500 });
  }

  const glossaryData = await getGlossaryForHospital(room.hospitalId, room.hospital.specialty);

  const transcriptionForm = new FormData();
  transcriptionForm.set("file", audio, audio.name || `${clientTurnId}.webm`);
  const transcriptionModel = normalizedTranscriptionModel(process.env.OPENAI_TRANSCRIPTION_MODEL);
  transcriptionForm.set("model", transcriptionModel);
  const transcriptionLanguage = transcriptionLanguageFor(role, patientLanguage);
  if (shouldSendTranscriptionLanguageHint(transcriptionLanguage)) {
    transcriptionForm.set("language", transcriptionLanguage);
  }
  transcriptionForm.set("response_format", "json");
  transcriptionForm.set("prompt", buildClinicTranscriptionPrompt(
    role === "staff" ? "ko" : patientLanguage,
    glossaryData.transcriptionHints,
    glossaryData.transcriptionHintMappings
  ));

  const transcriptionStartedAt = Date.now();
  let transcriptionResponse = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "OpenAI-Safety-Identifier": `clinic-voice-room-procedure-stt-${room.id}-${role}`
    },
    body: transcriptionForm
  });
  let transcriptionErrorDetail = "";

  if (!transcriptionResponse.ok) {
    transcriptionErrorDetail = await transcriptionResponse.text().catch(() => "");
    if (transcriptionForm.has("language") && isTranscriptionLanguageCompatibilityError(transcriptionErrorDetail)) {
      transcriptionForm.delete("language");
      transcriptionResponse = await fetch("https://api.openai.com/v1/audio/transcriptions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "OpenAI-Safety-Identifier": `clinic-voice-room-procedure-stt-${room.id}-${role}`
        },
        body: transcriptionForm
      });
      transcriptionErrorDetail = "";
    }
  }

  if (!transcriptionResponse.ok) {
    transcriptionErrorDetail ||= await transcriptionResponse.text().catch(() => "");
    if (isTranscriptionPromptCompatibilityError(transcriptionErrorDetail)) {
      transcriptionForm.delete("prompt");
      transcriptionResponse = await fetch("https://api.openai.com/v1/audio/transcriptions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "OpenAI-Safety-Identifier": `clinic-voice-room-procedure-stt-${room.id}-${role}`
        },
        body: transcriptionForm
      });
      transcriptionErrorDetail = "";
    }
  }

  if (!transcriptionResponse.ok) {
    const detail = transcriptionErrorDetail || (await transcriptionResponse.text().catch(() => ""));
    console.error("[procedure-turns transcription]", transcriptionResponse.status, detail);
    return NextResponse.json({ error: "Audio transcription failed" }, { status: 502 });
  }

  const transcriptionData = (await transcriptionResponse.json()) as TranscriptionResponse;
  let sourceText = transcriptionData.text?.trim();
  if (!sourceText) {
    return NextResponse.json({ error: "No speech was transcribed" }, { status: 422 });
  }

  const transcriptionSafety = await resolveUploadedMedicalTranscription({
    transcript: sourceText,
    inputLanguage: role === "staff" ? "ko" : patientLanguage,
    apiKey,
    audio,
    fileName: audio.name || `${clientTurnId}.webm`,
    model: transcriptionModel,
    language: transcriptionForm.has("language") ? transcriptionLanguage : undefined,
    safetyIdentifier: `clinic-voice-room-procedure-stt-retry-${roomId}-${role}`
  });
  transcriptionMs = Date.now() - transcriptionStartedAt;
  if (transcriptionSafety.status === "retry_required" || !transcriptionSafety.text) {
    return NextResponse.json(
      { status: "retry_required", error: "Medical terms could not be confirmed. Please speak again." },
      { status: 422 }
    );
  }
  sourceText = transcriptionSafety.text;

  const translationStartedAt = Date.now();
  const translation = await translateProcedureSourceText({ roomId: room.id, role, patientLanguage, sourceText, glossaryData });
  translationMs = Date.now() - translationStartedAt;
  if (translation.response) return translation.response;

  const direction = role === "staff" ? "ko_to_patient" as const : "patient_to_ko" as const;
  const qualityOutcome = await validateMedicalTranslation({
    apiKey,
    sourceText,
    translatedText: translation.translatedText,
    direction,
    sourceLanguage: role === "staff" ? "Korean" : languageLabels[patientLanguage].english,
    targetLanguage: role === "staff" ? languageLabels[patientLanguage].english : "Korean",
    safetyIdentifier: `clinic-voice-room-procedure-upload-quality-${room.id}-${role}`,
    initialTranslationSource: translation.translationSource === "verified" ? "verified_sentence" : "model",
    glossaryInstructions: buildClinicGlossaryInstructions(patientLanguage, glossaryData),
    semanticRequired: role === "patient",
    strictTranslate: async () => {
      const retry = await translateProcedureSourceText({ roomId: room.id, role, patientLanguage, sourceText, glossaryData });
      if (retry.response) return null;
      return {
        translatedText: retry.translatedText,
        model: retry.model,
        translationSource: retry.translationSource === "verified" ? "verified_sentence" as const : "model" as const
      };
    }
  });
  if (qualityOutcome.status !== "final" || !qualityOutcome.finalTranslation) {
    after(() => recordServerTranslationQualityMetric({
      eventId: `web-procedure-${messageId}`,
      hospitalId: room.hospitalId,
      staffId: room.hostStaffId,
      patientLanguage,
      direction,
      outcome: "retry_prompt",
      messageId,
      transport: "upload",
      speechEndToTranscriptMs: transcriptionMs,
      totalMs: Date.now() - startedAt,
      translationMs,
      packVersion: glossaryData.metadata?.packVersion,
      glossaryVersion: glossaryData.metadata?.glossaryVersion,
      normalizationVersion: glossaryData.metadata?.normalizationVersion,
      modelId: qualityOutcome.modelId ?? translation.model,
      enginePath: "strict",
      initialDeterministicStatus: qualityOutcome.initialDeterministic.status,
      finalDeterministicStatus: qualityOutcome.finalDeterministic.status,
      semanticStatus: qualityOutcome.semanticStatus,
      validationPath: qualityOutcome.validationPath,
      validationMs: qualityOutcome.validationMs,
      correctionMs: qualityOutcome.correctionMs,
      corrected: qualityOutcome.corrected,
      verifiedSentence: qualityOutcome.translationSource === "verified_sentence",
      riskLevel: qualityOutcome.finalDeterministic.riskLevel,
      riskReasons: qualityOutcome.finalDeterministic.riskReasons,
      matchedEntryIds: matchedGlossaryEntryIds(sourceText, glossaryData),
      modelAttemptCount: qualityOutcome.modelAttemptCount,
      validationAttemptCount: qualityOutcome.validationAttemptCount,
      correctionAttemptCount: qualityOutcome.correctionAttemptCount,
      strictAttemptCount: qualityOutcome.strictAttemptCount,
      errorCategory: qualityOutcome.failureReason
    }).catch((caught) => console.error("[procedure-turns upload quality metric]", caught)));
    return NextResponse.json(
      { status: "retry_required", error: "Translation accuracy could not be confirmed. Please speak again." },
      { status: 422 }
    );
  }
  translation.translatedText = normalizeClinicTranslation(qualityOutcome.finalTranslation, translation.targetLanguage, glossaryData);
  translation.guardFlags = mergeGuardFlags(translation.guardFlags, { quality: translationQualityGuardFromOutcome(qualityOutcome) });

  let savedMessage;
  const persistStartedAt = Date.now();
  try {
    savedMessage = await prisma.$transaction(async (tx) => {
      await tx.translationRoom.updateMany({
        where: { id: room.id, status: { not: "ended" } },
        data: { lastActiveAt: new Date() }
      });

      return tx.consultationMessage.create({
        data: {
          id: messageId,
          roomId: room.id,
          speaker: role,
          sourceText,
          text: translation.translatedText,
          targetLanguage: translation.targetLanguage,
          guardFlags: translation.guardFlags ? translation.guardFlags as Prisma.InputJsonObject : undefined
        }
      });
    });
  } catch (caught) {
    if (caught instanceof Prisma.PrismaClientKnownRequestError && caught.code === "P2002") {
      savedMessage = await prisma.consultationMessage.findFirst({
        where: { id: messageId, roomId: room.id, speaker: role }
      });
      if (!savedMessage) throw caught;
    } else {
      throw caught;
    }
  }
  persistMs = Date.now() - persistStartedAt;

  if (translation.guardFlags?.backTranslation?.status === "pending") {
    after(() =>
      runBackTranslationCheck({
        roomId: room.id,
        messageId: savedMessage.id,
        sourceText,
        translatedText: savedMessage.text,
        patientLanguage
      })
    );
  }

  const message = {
    id: savedMessage.id,
    speaker: savedMessage.speaker,
    sourceText: savedMessage.sourceText ?? undefined,
    text: savedMessage.text,
    targetLanguage: savedMessage.targetLanguage ?? undefined,
    createdAt: savedMessage.createdAt.toISOString(),
    readAt: savedMessage.readAt?.toISOString() ?? null,
    guardFlags: parseGuardFlags(savedMessage.guardFlags) ?? null
  };

  const messageGuardFlags = parseGuardFlags(savedMessage.guardFlags) ?? undefined;
  const messageTargetLanguage = (savedMessage.targetLanguage ?? undefined) as TargetLanguage | undefined;
  after(() =>
    recordTranslationSample({
      hospitalId: room.hospitalId,
      staffId: room.hostStaffId,
      roomId: room.id,
      messageId: savedMessage.id,
      source: "procedure_voice",
      mode: "procedure",
      direction: role === "staff" ? "ko_to_patient" : "patient_to_ko",
      patientLanguage,
      sourceText,
      translatedText: savedMessage.text,
      sourceLanguage: role === "staff" ? "ko" : patientLanguage,
      targetLanguage: translation.targetLanguage,
      model: translation.model,
      guardFlags: messageGuardFlags
    }).catch((caught) => {
      console.error("[procedure-turns upload sample]", caught);
    })
  );
  after(() =>
    broadcastServerTranslationMessage(room.id, {
      id: savedMessage.id,
      speaker: savedMessage.speaker,
      sourceText: savedMessage.sourceText ?? undefined,
      text: savedMessage.text,
      targetLanguage: messageTargetLanguage,
      createdAt: savedMessage.createdAt.toISOString(),
      readAt: savedMessage.readAt?.toISOString() ?? null,
      guardFlags: messageGuardFlags
    }).catch((caught) => {
      console.error("[procedure-turns upload broadcast]", caught);
    })
  );
  after(() => recordServerTranslationQualityMetric({
    eventId: `web-procedure-${savedMessage.id}`,
    hospitalId: room.hospitalId,
    staffId: room.hostStaffId,
    patientLanguage,
    direction,
    outcome: "success",
    messageId: savedMessage.id,
    transport: "upload",
    speechEndToTranscriptMs: transcriptionMs,
    totalMs: Date.now() - startedAt,
    translationMs,
    packVersion: glossaryData.metadata?.packVersion,
    glossaryVersion: glossaryData.metadata?.glossaryVersion,
    normalizationVersion: glossaryData.metadata?.normalizationVersion,
    modelId: qualityOutcome.modelId ?? translation.model,
    enginePath: qualityOutcome.validationPath === "strict" ? "strict" : "upload_fallback",
    initialDeterministicStatus: qualityOutcome.initialDeterministic.status,
    finalDeterministicStatus: qualityOutcome.finalDeterministic.status,
    semanticStatus: qualityOutcome.semanticStatus,
    validationPath: qualityOutcome.validationPath,
    validationMs: qualityOutcome.validationMs,
    correctionMs: qualityOutcome.correctionMs,
    corrected: qualityOutcome.corrected,
    verifiedSentence: qualityOutcome.translationSource === "verified_sentence",
    riskLevel: qualityOutcome.finalDeterministic.riskLevel,
    riskReasons: qualityOutcome.finalDeterministic.riskReasons,
    matchedEntryIds: matchedGlossaryEntryIds(sourceText, glossaryData),
    modelAttemptCount: qualityOutcome.modelAttemptCount,
    validationAttemptCount: qualityOutcome.validationAttemptCount,
    correctionAttemptCount: qualityOutcome.correctionAttemptCount,
    strictAttemptCount: qualityOutcome.strictAttemptCount
  }).catch((caught) => console.error("[procedure-turns upload quality metric]", caught)));

  console.log(
    "[procedure-turns upload timing]",
    JSON.stringify({
      roomMode: room.roomMode,
      messageId: savedMessage.id,
      role,
      model: translation.model,
      transcriptionMs,
      translationMs,
      persistMs,
      totalMs: Date.now() - startedAt
    })
  );

  return NextResponse.json({
    message,
    sourceText,
    translatedText: savedMessage.text,
    finalTranslation: savedMessage.text,
    status: "final",
    model: translation.model
  });
}

export async function POST(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    return handleRealtimeStaffMessage(request);
  }
  return handleAudioTurn(request);
}
