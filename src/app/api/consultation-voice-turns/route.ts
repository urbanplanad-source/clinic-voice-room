import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentStaff } from "@/lib/session";
import { clientIp, rateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { buildClinicGlossaryInstructions, normalizeClinicTranslation } from "@/lib/clinic-glossary";
import { isPatientLanguage, languageLabels, sourceTargetFor, type ParticipantRole, type PatientLanguage } from "@/lib/languages";

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
  role: z.literal("staff"),
  patientLanguage: z.custom<PatientLanguage>((value) => isPatientLanguage(value)),
  sourceText: z.string().trim().min(1).max(4000),
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

async function createMessage(params: {
  roomId: string;
  messageId: string;
  role: ParticipantRole;
  sourceText: string;
  text: string;
  targetLanguage: TargetLanguage;
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
          sourceText: params.sourceText,
          text: params.text,
          targetLanguage: params.targetLanguage
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
  const room = await prisma.translationRoom.findUnique({ where: { id: params.roomId } });
  if (!room || room.status === "ended" || room.patientLanguage !== params.patientLanguage || room.roomMode !== "consultation") {
    return { response: NextResponse.json({ error: "Room not available" }, { status: 404 }) };
  }

  if (params.role === "staff") {
    const staff = await getCurrentStaff();
    if (!staff || staff.id !== room.hostStaffId) {
      return { response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
    }
  } else if (params.roomToken !== room.roomToken) {
    return { response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  return { room };
}

async function translateSourceText(params: {
  roomId: string;
  role: ParticipantRole;
  patientLanguage: PatientLanguage;
  sourceText: string;
}) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return { response: NextResponse.json({ error: "OPENAI_API_KEY is not configured" }, { status: 500 }) };
  }

  const direction = sourceTargetFor(params.role, params.patientLanguage);
  const targetLanguage: TargetLanguage = params.role === "staff" ? params.patientLanguage : "ko";
  const targetLabel = targetLanguage === "ko" ? "Korean" : languageLabels[params.patientLanguage].english;
  const model = process.env.OPENAI_TEXT_TRANSLATION_MODEL ?? "gpt-5.5";
  const instructions = [
    "You are a professional medical interpreter for a dermatology and plastic surgery clinic.",
    "Translate the user's spoken consultation message accurately and naturally.",
    `Target language: ${targetLabel}.`,
    direction.instructions,
    "Preserve the original clinical meaning. Do not add advice, diagnosis, consent language, or extra explanation.",
    "If the source text is ambiguous, keep the translation concise and neutral rather than guessing.",
    "Return only the translated text. No labels, quotes, markdown, or commentary.",
    buildClinicGlossaryInstructions(params.patientLanguage)
  ].join("\n");

  const translationResponse = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "OpenAI-Safety-Identifier": `clinic-voice-room-consultation-text-${params.roomId}-${params.role}`
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
          content: [{ type: "input_text", text: params.sourceText }]
        }
      ]
    })
  });

  if (!translationResponse.ok) {
    const detail = await translationResponse.text().catch(() => "");
    console.error("[consultation-voice-turns translation]", translationResponse.status, detail);
    return { response: NextResponse.json({ error: "Consultation voice translation failed" }, { status: 502 }) };
  }

  const translationData = (await translationResponse.json()) as ResponsesApiResponse;
  const translatedText = extractOutputText(translationData);
  if (!translatedText) {
    return { response: NextResponse.json({ error: "No translated text was returned" }, { status: 502 }) };
  }

  return {
    translatedText: normalizeClinicTranslation(translatedText, targetLanguage),
    targetLanguage,
    model
  };
}

async function handleRealtimeStaffMessage(request: Request) {
  const parsed = realtimeMessageSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid consultation voice payload" }, { status: 400 });
  }

  const limited = rateLimit({
    key: `consultation-voice:${clientIp(request)}:${parsed.data.roomId}:${parsed.data.role}`,
    limit: 30,
    windowMs: 60 * 1000
  });
  if (!limited.ok) return rateLimitResponse(limited.retryAfter);

  const authorization = await authorizeRoom(parsed.data);
  if (authorization.response) return authorization.response;

  const normalizedText = normalizeClinicTranslation(parsed.data.translatedText, parsed.data.patientLanguage);
  const message = await createMessage({
    roomId: parsed.data.roomId,
    messageId: parsed.data.messageId,
    role: parsed.data.role,
    sourceText: parsed.data.sourceText,
    text: normalizedText,
    targetLanguage: parsed.data.patientLanguage
  });

  return NextResponse.json({
    message: {
      id: message.id,
      speaker: message.speaker,
      sourceText: message.sourceText,
      text: message.text,
      targetLanguage: message.targetLanguage,
      createdAt: message.createdAt.toISOString(),
      readAt: message.readAt?.toISOString() ?? null
    },
    sourceText: parsed.data.sourceText,
    translatedText: message.text,
    model: "realtime"
  });
}

async function handleAudioTurn(request: Request) {
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

  const limited = rateLimit({
    key: `consultation-voice:${clientIp(request)}:${roomId}:${role}`,
    limit: 30,
    windowMs: 60 * 1000
  });
  if (!limited.ok) return rateLimitResponse(limited.retryAfter);

  const authorization = await authorizeRoom({ roomId, role, roomToken, patientLanguage });
  if (authorization.response) return authorization.response;

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
        readAt: existingMessage.readAt?.toISOString() ?? null
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
  transcriptionForm.set("model", process.env.OPENAI_TRANSCRIPTION_MODEL ?? "gpt-4o-mini-transcribe");
  transcriptionForm.set("language", transcriptionLanguageFor(role, patientLanguage));
  transcriptionForm.set("response_format", "json");

  const transcriptionResponse = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "OpenAI-Safety-Identifier": `clinic-voice-room-consultation-stt-${roomId}-${role}`
    },
    body: transcriptionForm
  });

  if (!transcriptionResponse.ok) {
    const detail = await transcriptionResponse.text().catch(() => "");
    console.error("[consultation-voice-turns transcription]", transcriptionResponse.status, detail);
    return NextResponse.json({ error: "Audio transcription failed" }, { status: 502 });
  }

  const transcriptionData = (await transcriptionResponse.json()) as TranscriptionResponse;
  const sourceText = transcriptionData.text?.trim();
  if (!sourceText) {
    return NextResponse.json({ error: "No speech was transcribed" }, { status: 422 });
  }

  const translation = await translateSourceText({ roomId, role, patientLanguage, sourceText });
  if (translation.response) return translation.response;

  const message = await createMessage({
    roomId,
    messageId,
    role,
    sourceText,
    text: translation.translatedText,
    targetLanguage: translation.targetLanguage
  });

  return NextResponse.json({
    message: {
      id: message.id,
      speaker: message.speaker,
      sourceText: message.sourceText,
      text: message.text,
      targetLanguage: message.targetLanguage,
      createdAt: message.createdAt.toISOString(),
      readAt: message.readAt?.toISOString() ?? null
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
