import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentStaff } from "@/lib/session";
import { clientIp, rateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { isPatientLanguage, languageLabels, sourceTargetFor, type PatientLanguage } from "@/lib/languages";
import { buildClinicGlossaryInstructions, normalizeClinicTranslation } from "@/lib/clinic-glossary";
import { normalizedTextTranslationModel } from "@/lib/openai-models";
import { isPatientRoomRequestAuthorized } from "@/lib/patient-room-session";

const schema = z.object({
  roomId: z.string(),
  roomToken: z.string().optional(),
  messageId: z.string().min(1).max(120).optional(),
  role: z.enum(["staff", "patient"]),
  patientLanguage: z.custom<PatientLanguage>((value) => isPatientLanguage(value)),
  text: z.string().trim().min(1).max(2000)
});

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

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid translation request" }, { status: 400 });
  }

  const limited = await rateLimit({
    key: `text-translate:${clientIp(request)}:${parsed.data.roomId}:${parsed.data.role}`,
    limit: 60,
    windowMs: 60 * 1000
  });
  if (!limited.ok) {
    return rateLimitResponse(limited.retryAfter);
  }

  const room = await prisma.translationRoom.findUnique({ where: { id: parsed.data.roomId } });
  if (!room || room.status === "ended" || room.patientLanguage !== parsed.data.patientLanguage || room.roomMode !== "consultation") {
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

  if (parsed.data.messageId) {
    const existingMessage = await prisma.consultationMessage.findFirst({
      where: {
        id: parsed.data.messageId,
        roomId: room.id,
        speaker: parsed.data.role
      }
    });
    if (existingMessage) {
      return NextResponse.json({
        translatedText: existingMessage.text,
        message: {
          id: existingMessage.id,
          speaker: existingMessage.speaker,
          sourceText: existingMessage.sourceText,
          text: existingMessage.text,
          targetLanguage: existingMessage.targetLanguage,
          createdAt: existingMessage.createdAt.toISOString(),
          readAt: existingMessage.readAt?.toISOString() ?? null
        },
        model: "cached"
      });
    }
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "OPENAI_API_KEY is not configured" }, { status: 500 });
  }

  const direction = sourceTargetFor(parsed.data.role, room.patientLanguage);
  const targetLanguage = parsed.data.role === "staff" ? room.patientLanguage : "ko";
  const targetLabel = targetLanguage === "ko" ? "Korean" : languageLabels[room.patientLanguage].english;
  const model = normalizedTextTranslationModel(process.env.OPENAI_TEXT_TRANSLATION_MODEL);
  const instructions = [
    "You are a professional medical interpreter for a dermatology and plastic surgery clinic.",
    "Translate the user's message accurately and naturally for a live consultation.",
    `Target language: ${targetLabel}.`,
    direction.instructions,
    "Preserve the original clinical meaning. Do not add advice, diagnosis, consent language, or extra explanation.",
    "If the source text is ambiguous, keep the translation concise and neutral rather than guessing.",
    "Return only the translated text. No labels, quotes, markdown, or commentary.",
    buildClinicGlossaryInstructions(room.patientLanguage)
  ].join("\n");

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "OpenAI-Safety-Identifier": `clinic-voice-room-text-${room.id}-${parsed.data.role}`
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
          content: [{ type: "input_text", text: parsed.data.text }]
        }
      ]
    })
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    console.error("[translate-text]", response.status, detail);
    return NextResponse.json({ error: "Text translation failed" }, { status: 502 });
  }

  const data = (await response.json()) as ResponsesApiResponse;
  const translatedText = extractOutputText(data);
  if (!translatedText) {
    return NextResponse.json({ error: "No translated text was returned" }, { status: 502 });
  }

  const normalizedText = normalizeClinicTranslation(translatedText, targetLanguage);
  let message;
  try {
    message = await prisma.$transaction(async (tx) => {
      await tx.translationRoom.update({
        where: { id: room.id },
        data: { lastActiveAt: new Date() }
      });

      return tx.consultationMessage.create({
        data: {
          id: parsed.data.messageId,
          roomId: room.id,
          speaker: parsed.data.role,
          sourceText: parsed.data.text,
          text: normalizedText,
          targetLanguage
        }
      });
    });
  } catch (caught) {
    if (caught instanceof Prisma.PrismaClientKnownRequestError && caught.code === "P2002" && parsed.data.messageId) {
      message = await prisma.consultationMessage.findFirst({
        where: {
          id: parsed.data.messageId,
          roomId: room.id,
          speaker: parsed.data.role
        }
      });
      if (!message) throw caught;
    } else {
      throw caught;
    }
  }

  return NextResponse.json({
    translatedText: normalizedText,
    message: {
      id: message.id,
      speaker: message.speaker,
      sourceText: message.sourceText,
      text: message.text,
      targetLanguage: message.targetLanguage,
      createdAt: message.createdAt.toISOString(),
      readAt: message.readAt?.toISOString() ?? null
    },
    model
  });
}
