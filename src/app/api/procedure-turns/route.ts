import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentStaff } from "@/lib/session";
import { clientIp, rateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { buildClinicGlossaryInstructions, normalizeClinicTranslation } from "@/lib/clinic-glossary";
import { isPatientLanguage, languageLabels, sourceTargetFor, type ParticipantRole, type PatientLanguage } from "@/lib/languages";
import { normalizedTextTranslationModel, normalizedTranscriptionModel } from "@/lib/openai-models";
import { isPatientRoomRequestAuthorized } from "@/lib/patient-room-session";

type TargetLanguage = PatientLanguage | "ko";

type TranscriptionResponse = {
  text?: string;
};

type ResponsesApiContent = {
  type?: string;
  text?: string;
};

type ResponsesApiOutputItem = {
  type?: string;
  content?: ResponsesApiContent[];
};

type ResponsesApiResponse = {
  output_text?: string;
  output?: ResponsesApiOutputItem[];
};

const realtimeMessageSchema = z.object({
  roomId: z.string(),
  roomToken: z.string().optional(),
  messageId: z.string().min(1).max(120),
  role: z.enum(["staff", "patient"]),
  patientLanguage: z.custom<PatientLanguage>((value) => isPatientLanguage(value)),
  sourceText: z.string().trim().max(4000).optional().default(""),
  translatedText: z.string().trim().min(1).max(4000)
});

function extractOutputText(data: ResponsesApiResponse) {
  if (typeof data.output_text === "string") return data.output_text.trim();

  return (
    data.output
      ?.flatMap((item) => item.content ?? [])
      .map((content) => content.text)
      .filter((text): text is string => typeof text === "string")
      .join("")
      .trim() ?? ""
  );
}

function textField(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function transcriptionLanguageFor(role: ParticipantRole, patientLanguage: PatientLanguage) {
  if (role === "staff") return "ko";
  if (patientLanguage === "zh_tw") return "zh";
  return patientLanguage;
}

async function handleRealtimeStaffMessage(request: Request) {
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

  const room = await prisma.translationRoom.findUnique({ where: { id: parsed.data.roomId } });
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
  const normalizedText = normalizeClinicTranslation(parsed.data.translatedText, targetLanguage);
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
          targetLanguage
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

  return NextResponse.json({
    message: {
      id: savedMessage.id,
      speaker: savedMessage.speaker,
      sourceText: savedMessage.sourceText ?? undefined,
      text: savedMessage.text,
      targetLanguage: savedMessage.targetLanguage ?? undefined,
      createdAt: savedMessage.createdAt.toISOString(),
      readAt: savedMessage.readAt?.toISOString() ?? null
    },
    sourceText: savedMessage.sourceText ?? "",
    translatedText: savedMessage.text,
    model: "realtime"
  });
}

async function handleAudioTurn(request: Request) {
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

  const room = await prisma.translationRoom.findUnique({ where: { id: roomId } });
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
        readAt: existingMessage.readAt?.toISOString() ?? null
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

  const transcriptionForm = new FormData();
  transcriptionForm.set("file", audio, audio.name || `${clientTurnId}.webm`);
  transcriptionForm.set("model", normalizedTranscriptionModel(process.env.OPENAI_TRANSCRIPTION_MODEL));
  transcriptionForm.set("language", transcriptionLanguageFor(role, patientLanguage));
  transcriptionForm.set("response_format", "json");

  const transcriptionResponse = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "OpenAI-Safety-Identifier": `clinic-voice-room-procedure-stt-${room.id}-${role}`
    },
    body: transcriptionForm
  });

  if (!transcriptionResponse.ok) {
    const detail = await transcriptionResponse.text().catch(() => "");
    console.error("[procedure-turns transcription]", transcriptionResponse.status, detail);
    return NextResponse.json({ error: "Audio transcription failed" }, { status: 502 });
  }

  const transcriptionData = (await transcriptionResponse.json()) as TranscriptionResponse;
  const sourceText = transcriptionData.text?.trim();
  if (!sourceText) {
    return NextResponse.json({ error: "No speech was transcribed" }, { status: 422 });
  }

  const direction = sourceTargetFor(role, patientLanguage);
  const targetLanguage: TargetLanguage = role === "staff" ? patientLanguage : "ko";
  const targetLabel = targetLanguage === "ko" ? "Korean" : languageLabels[patientLanguage].english;
  const model = normalizedTextTranslationModel(process.env.OPENAI_TEXT_TRANSLATION_MODEL);
  const instructions = [
    "You are a professional medical interpreter for a dermatology and plastic surgery procedure room.",
    "Translate the user's short spoken procedure-room message accurately and naturally.",
    `Target language: ${targetLabel}.`,
    direction.instructions,
    "Preserve clinical meaning, urgency, numbers, body parts, and safety instructions.",
    "Do not add advice, diagnosis, consent language, labels, quotes, markdown, or commentary.",
    "Return only the translated text.",
    buildClinicGlossaryInstructions(patientLanguage)
  ].join("\n");

  const translationResponse = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "OpenAI-Safety-Identifier": `clinic-voice-room-procedure-text-${room.id}-${role}`
    },
    body: JSON.stringify({
      model,
      reasoning: { effort: "low" },
      text: { verbosity: "low" },
      input: [
        {
          role: "system",
          content: [{ type: "input_text", text: instructions }]
        },
        {
          role: "user",
          content: [{ type: "input_text", text: sourceText }]
        }
      ]
    })
  });

  if (!translationResponse.ok) {
    const detail = await translationResponse.text().catch(() => "");
    console.error("[procedure-turns translation]", translationResponse.status, detail);
    return NextResponse.json({ error: "Procedure turn translation failed" }, { status: 502 });
  }

  const translationData = (await translationResponse.json()) as ResponsesApiResponse;
  const translatedText = extractOutputText(translationData);
  if (!translatedText) {
    return NextResponse.json({ error: "No translated text was returned" }, { status: 502 });
  }

  const normalizedText = normalizeClinicTranslation(translatedText, targetLanguage);
  let savedMessage;
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
          text: normalizedText,
          targetLanguage
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

  const message = {
    id: savedMessage.id,
    speaker: savedMessage.speaker,
    sourceText: savedMessage.sourceText ?? undefined,
    text: savedMessage.text,
    targetLanguage: savedMessage.targetLanguage ?? undefined,
    createdAt: savedMessage.createdAt.toISOString(),
    readAt: savedMessage.readAt?.toISOString() ?? null
  };

  return NextResponse.json({ message, sourceText, translatedText: normalizedText, model });
}

export async function POST(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    return handleRealtimeStaffMessage(request);
  }
  return handleAudioTurn(request);
}
