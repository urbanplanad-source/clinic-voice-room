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
import { broadcastServerTranslationMessage } from "@/lib/supabase-realtime-server";
import { recordTranslationSample } from "@/lib/translation-samples";
import { isClearlyNotKoreanTranslation } from "@/lib/translation-language-guard";

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

async function createMessage(params: {
  roomId: string;
  messageId: string;
  role: ParticipantRole;
  sourceText?: string;
  text: string;
  targetLanguage: TargetLanguage;
  guardFlags?: GuardFlags;
}) {
  try {
    return await prisma.$transaction(async (tx) => {
      await tx.translationRoom.update({
        where: { id: params.roomId },
        data: { lastActiveAt: new Date() }
      });

      return tx.consultationMessage.create({
        data: {
          id: params.messageId,
          roomId: params.roomId,
          speaker: params.role,
          sourceText: params.sourceText?.trim() || null,
          text: params.text,
          targetLanguage: params.targetLanguage,
          guardFlags: params.guardFlags ? params.guardFlags as Prisma.InputJsonObject : undefined
        }
      });
    });
  } catch (caught) {
    if (caught instanceof Prisma.PrismaClientKnownRequestError && caught.code === "P2002") {
      const existingMessage = await prisma.consultationMessage.findFirst({
        where: {
          id: params.messageId,
          roomId: params.roomId,
          speaker: params.role
        }
      });
      if (existingMessage) return existingMessage;
    }
    throw caught;
  }
}

async function authorizeRoom(params: {
  roomId: string;
  role: ParticipantRole;
  roomToken?: string;
  patientLanguage: PatientLanguage;
}) {
  const room = await prisma.translationRoom.findUnique({
    where: { id: params.roomId },
    include: { hospital: { select: { specialty: true } } }
  });
  if (!room || room.status === "ended" || room.patientLanguage !== params.patientLanguage || room.roomMode !== "consultation") {
    return { response: NextResponse.json({ error: "Room not available" }, { status: 404 }) };
  }

  if (params.role === "staff") {
    const staff = await getCurrentStaff();
    if (!staff || staff.id !== room.hostStaffId) {
      return { response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
    }
  } else if (!(await isPatientRoomRequestAuthorized(room, params.roomToken))) {
    return { response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  return { room };
}

async function translateSourceText(params: {
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
      translationSource: "verified" as const
    };
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return { response: NextResponse.json({ error: "OPENAI_API_KEY is not configured" }, { status: 500 }) };
  }

  const instructions = [
    "You are a professional medical interpreter for a dermatology and plastic surgery clinic.",
    "Translate the user's spoken consultation message accurately and naturally.",
    `Target language: ${targetLabel}.`,
    direction.instructions,
    "Preserve the speech act exactly: questions must remain questions, requests must remain requests, and statements must remain statements.",
    "Never answer the speaker, predict the other participant's reply, or continue the conversation.",
    "Preserve the original clinical meaning. Do not add advice, diagnosis, consent language, or extra explanation.",
    "If the source text is ambiguous, keep the translation concise and neutral rather than guessing.",
    "Return only the translated text. No labels, quotes, markdown, or commentary.",
    buildClinicGlossaryInstructions(params.patientLanguage, params.glossaryData)
  ].join("\n");

  let translation;
  try {
    translation = await translateWithOpenAITextSafety({
      apiKey,
      safetyIdentifier: `clinic-voice-room-consultation-text-${params.roomId}-${params.role}`,
      sourceText: params.sourceText,
      instructions,
      glossaryData: params.glossaryData,
      errorLabel: "[consultation-voice-turns translation]",
      context: "consultation-voice-turns"
    });
  } catch (caught) {
    if (caught instanceof Error && caught.message === "empty_translation") {
      return { response: NextResponse.json({ error: "No translated text was returned" }, { status: 502 }) };
    }
    return { response: NextResponse.json({ error: "Consultation voice translation failed" }, { status: 502 }) };
  }

  if (!translation.translatedText) {
    return { response: NextResponse.json({ error: "No translated text was returned" }, { status: 502 }) };
  }

  const translatedText = normalizeClinicTranslation(translation.translatedText, targetLanguage, params.glossaryData);
  if (targetLanguage === "ko" && isClearlyNotKoreanTranslation(params.sourceText, translatedText)) {
    console.error(
      "[consultation-voice-turns translation] rejected non-Korean target",
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
    translatedText,
    targetLanguage,
    model: translation.model,
    guardFlags,
    translationSource: "llm" as const
  };
}

async function handleRealtimeStaffMessage(request: Request) {
  const parsed = realtimeMessageSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid consultation voice payload" }, { status: 400 });
  }

  const limited = await rateLimit({
    key: `consultation-voice:${clientIp(request)}:${parsed.data.roomId}:${parsed.data.role}`,
    limit: 30,
    windowMs: 60 * 1000
  });
  if (!limited.ok) return rateLimitResponse(limited.retryAfter);

  const authorization = await authorizeRoom(parsed.data);
  if (authorization.response) return authorization.response;
  const glossaryData = await getGlossaryForHospital(authorization.room.hospitalId, authorization.room.hospital.specialty);

  const targetLanguage: TargetLanguage = parsed.data.role === "staff" ? parsed.data.patientLanguage : "ko";
  let normalizedText = normalizeClinicTranslation(parsed.data.translatedText, targetLanguage, glossaryData);
  let model = "realtime";
  let translationSource: "realtime" | "llm" | "verified" = "realtime";
  let guardFlags: GuardFlags | undefined;
  let repairedTargetLanguage = false;

  const targetLanguageMismatch =
    parsed.data.role === "patient" &&
    isClearlyNotKoreanTranslation(parsed.data.sourceText, normalizedText);

  if (targetLanguageMismatch) {
    if (!parsed.data.sourceText || !parsed.data.sourceTranscriptComplete) {
      console.warn(
        "[consultation-voice-turns realtime target-language] blocked without complete source transcript",
        JSON.stringify({ roomId: parsed.data.roomId, messageId: parsed.data.messageId })
      );
      return NextResponse.json(
        { error: "Complete source transcript is required to repair the Korean translation" },
        { status: 422 }
      );
    }

    const retry = await translateSourceText({
      roomId: parsed.data.roomId,
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
      "[consultation-voice-turns realtime target-language] repaired before persist",
      JSON.stringify({ roomId: parsed.data.roomId, messageId: parsed.data.messageId, model })
    );
  }

  if (!repairedTargetLanguage && numberGuardEnabled() && parsed.data.sourceText && parsed.data.sourceTranscriptComplete) {
    try {
      const comparison = compareNumericSignatures(parsed.data.sourceText, parsed.data.translatedText);
      if (!comparison.ok) {
        const retry = await translateSourceText({
          roomId: parsed.data.roomId,
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
      console.error("[consultation-voice-turns realtime number-guard] fail-open", caught);
    }
  } else if (numberGuardEnabled() && parsed.data.sourceText && !parsed.data.sourceTranscriptComplete) {
    console.log(
      "[consultation-voice-turns realtime number-guard] skipped incomplete source transcript",
      JSON.stringify({ roomId: parsed.data.roomId, messageId: parsed.data.messageId })
    );
  }

  guardFlags = mergeGuardFlags(
    guardFlags,
    pendingBackTranslationGuard({
      sourceText: parsed.data.sourceText,
      role: parsed.data.role,
      targetLanguage,
      translationSource
    })
  );

  const message = await createMessage({
    roomId: parsed.data.roomId,
    messageId: parsed.data.messageId,
    role: parsed.data.role,
    sourceText: parsed.data.sourceText,
    text: normalizedText,
    targetLanguage,
    guardFlags
  });

  if (guardFlags?.backTranslation?.status === "pending") {
    after(() =>
      runBackTranslationCheck({
        roomId: parsed.data.roomId,
        messageId: message.id,
        sourceText: parsed.data.sourceText,
        translatedText: normalizedText,
        patientLanguage: parsed.data.patientLanguage
      })
    );
  }

  const messageGuardFlags = parseGuardFlags(message.guardFlags) ?? undefined;
  const messageTargetLanguage = (message.targetLanguage ?? undefined) as TargetLanguage | undefined;
  after(() =>
    recordTranslationSample({
      hospitalId: authorization.room.hospitalId,
      staffId: authorization.room.hostStaffId,
      roomId: authorization.room.id,
      messageId: message.id,
      source: "consultation_voice",
      mode: "consultation",
      direction: parsed.data.role === "staff" ? "ko_to_patient" : "patient_to_ko",
      patientLanguage: parsed.data.patientLanguage,
      sourceText: message.sourceText ?? parsed.data.sourceText,
      translatedText: message.text,
      sourceLanguage: parsed.data.role === "staff" ? "ko" : parsed.data.patientLanguage,
      targetLanguage,
      model,
      guardFlags: messageGuardFlags,
      sourceTranscriptComplete: parsed.data.sourceTranscriptComplete
    }).catch((caught) => {
      console.error("[consultation-voice-turns realtime sample]", caught);
    })
  );
  after(() =>
    broadcastServerTranslationMessage(parsed.data.roomId, {
      id: message.id,
      speaker: message.speaker,
      sourceText: message.sourceText ?? undefined,
      text: message.text,
      targetLanguage: messageTargetLanguage,
      createdAt: message.createdAt.toISOString(),
      readAt: message.readAt?.toISOString() ?? null,
      guardFlags: messageGuardFlags
    }).catch((caught) => {
      console.error("[consultation-voice-turns realtime broadcast]", caught);
    })
  );

  return NextResponse.json({
    message: {
      id: message.id,
      speaker: message.speaker,
      sourceText: message.sourceText,
      text: message.text,
      targetLanguage: message.targetLanguage,
      createdAt: message.createdAt.toISOString(),
      readAt: message.readAt?.toISOString() ?? null,
      guardFlags: messageGuardFlags ?? null
    },
    sourceText: parsed.data.sourceText,
    translatedText: message.text,
    model
  });
}

async function handleAudioTurn(request: Request) {
  const startedAt = Date.now();
  let transcriptionMs = 0;
  let translationMs = 0;
  let persistMs = 0;
  const formData = await request.formData().catch(() => null);
  if (!formData) {
    return NextResponse.json({ error: "Invalid consultation voice payload" }, { status: 400 });
  }

  const roomId = textField(formData, "roomId");
  const roomToken = textField(formData, "roomToken");
  const clientTurnId = textField(formData, "clientTurnId");
  const role = textField(formData, "role") as ParticipantRole;
  const patientLanguageValue = textField(formData, "patientLanguage");
  const audio = formData.get("audio");

  if (!roomId || !clientTurnId || (role !== "staff" && role !== "patient") || !isPatientLanguage(patientLanguageValue) || !(audio instanceof File)) {
    return NextResponse.json({ error: "Invalid consultation voice payload" }, { status: 400 });
  }
  const patientLanguage = patientLanguageValue;

  if (audio.size <= 0 || audio.size > 15 * 1024 * 1024) {
    return NextResponse.json({ error: "Audio turn is empty or too large" }, { status: 413 });
  }

  const limited = await rateLimit({
    key: `consultation-voice:${clientIp(request)}:${roomId}:${role}`,
    limit: 30,
    windowMs: 60 * 1000
  });
  if (!limited.ok) return rateLimitResponse(limited.retryAfter);

  const authorization = await authorizeRoom({ roomId, role, roomToken, patientLanguage });
  if (authorization.response) return authorization.response;
  const glossaryData = await getGlossaryForHospital(authorization.room.hospitalId, authorization.room.hospital.specialty);

  const messageId = `${role}-voice-${clientTurnId}`;
  const existingMessage = await prisma.consultationMessage.findFirst({
    where: { id: messageId, roomId, speaker: role }
  });
  if (existingMessage) {
    return NextResponse.json({
      message: {
        id: existingMessage.id,
        speaker: existingMessage.speaker,
        sourceText: existingMessage.sourceText,
        text: existingMessage.text,
        targetLanguage: existingMessage.targetLanguage ?? (role === "staff" ? patientLanguage : "ko"),
        createdAt: existingMessage.createdAt.toISOString(),
        readAt: existingMessage.readAt?.toISOString() ?? null,
        guardFlags: parseGuardFlags(existingMessage.guardFlags) ?? null
      },
      translatedText: existingMessage.text,
      model: "cached"
    });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "OPENAI_API_KEY is not configured" }, { status: 500 });
  }

  const transcriptionForm = new FormData();
  transcriptionForm.set("file", audio, audio.name || `${clientTurnId}.webm`);
  transcriptionForm.set("model", normalizedTranscriptionModel(process.env.OPENAI_TRANSCRIPTION_MODEL));
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
      "OpenAI-Safety-Identifier": `clinic-voice-room-consultation-stt-${roomId}-${role}`
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
          "OpenAI-Safety-Identifier": `clinic-voice-room-consultation-stt-${roomId}-${role}`
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
          "OpenAI-Safety-Identifier": `clinic-voice-room-consultation-stt-${roomId}-${role}`
        },
        body: transcriptionForm
      });
      transcriptionErrorDetail = "";
    }
  }

  if (!transcriptionResponse.ok) {
    const detail = transcriptionErrorDetail || (await transcriptionResponse.text().catch(() => ""));
    console.error("[consultation-voice-turns transcription]", transcriptionResponse.status, detail);
    return NextResponse.json({ error: "Audio transcription failed" }, { status: 502 });
  }

  const transcriptionData = (await transcriptionResponse.json()) as TranscriptionResponse;
  transcriptionMs = Date.now() - transcriptionStartedAt;
  const sourceText = transcriptionData.text?.trim();
  if (!sourceText) {
    return NextResponse.json({ error: "No speech was transcribed" }, { status: 422 });
  }

  const translationStartedAt = Date.now();
  const translation = await translateSourceText({ roomId, role, patientLanguage, sourceText, glossaryData });
  translationMs = Date.now() - translationStartedAt;
  if (translation.response) return translation.response;

  const persistStartedAt = Date.now();
  const message = await createMessage({
    roomId,
    messageId,
    role,
    sourceText,
    text: translation.translatedText,
    targetLanguage: translation.targetLanguage,
    guardFlags: translation.guardFlags
  });
  persistMs = Date.now() - persistStartedAt;

  if (translation.guardFlags?.backTranslation?.status === "pending") {
    after(() =>
      runBackTranslationCheck({
        roomId,
        messageId: message.id,
        sourceText,
        translatedText: translation.translatedText,
        patientLanguage
      })
    );
  }

  const messageGuardFlags = parseGuardFlags(message.guardFlags) ?? undefined;
  const messageTargetLanguage = (message.targetLanguage ?? undefined) as TargetLanguage | undefined;
  after(() =>
    recordTranslationSample({
      hospitalId: authorization.room.hospitalId,
      staffId: authorization.room.hostStaffId,
      roomId,
      messageId: message.id,
      source: "consultation_voice",
      mode: "consultation",
      direction: role === "staff" ? "ko_to_patient" : "patient_to_ko",
      patientLanguage,
      sourceText,
      translatedText: message.text,
      sourceLanguage: role === "staff" ? "ko" : patientLanguage,
      targetLanguage: translation.targetLanguage,
      model: translation.model,
      guardFlags: messageGuardFlags
    }).catch((caught) => {
      console.error("[consultation-voice-turns upload sample]", caught);
    })
  );
  after(() =>
    broadcastServerTranslationMessage(roomId, {
      id: message.id,
      speaker: message.speaker,
      sourceText: message.sourceText ?? undefined,
      text: message.text,
      targetLanguage: messageTargetLanguage,
      createdAt: message.createdAt.toISOString(),
      readAt: message.readAt?.toISOString() ?? null,
      guardFlags: messageGuardFlags
    }).catch((caught) => {
      console.error("[consultation-voice-turns upload broadcast]", caught);
    })
  );

  console.log(
    "[consultation-voice-turns upload timing]",
    JSON.stringify({
      roomMode: authorization.room.roomMode,
      messageId: message.id,
      role,
      model: translation.model,
      transcriptionMs,
      translationMs,
      persistMs,
      totalMs: Date.now() - startedAt
    })
  );

  return NextResponse.json({
    message: {
      id: message.id,
      speaker: message.speaker,
      sourceText: message.sourceText,
      text: message.text,
      targetLanguage: message.targetLanguage,
      createdAt: message.createdAt.toISOString(),
      readAt: message.readAt?.toISOString() ?? null,
      guardFlags: parseGuardFlags(message.guardFlags) ?? null
    },
    sourceText,
    translatedText: message.text,
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
