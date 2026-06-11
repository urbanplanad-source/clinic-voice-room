import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentStaff } from "@/lib/session";
import { clientIp, rateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { isPatientRoomRequestAuthorized } from "@/lib/patient-room-session";

const reasons = ["mistranslation", "wrong_term", "awkward", "other"] as const;

const schema = z.object({
  roomId: z.string().min(1),
  roomToken: z.string().optional(),
  messageId: z.string().min(1),
  reporterRole: z.enum(["staff", "patient"]),
  reason: z.enum(reasons).optional()
});

function sourceLanguageForMessage(speaker: "staff" | "patient", patientLanguage: string) {
  return speaker === "staff" ? "ko" : patientLanguage;
}

function targetLanguageForMessage(speaker: "staff" | "patient", patientLanguage: string, targetLanguage?: string | null) {
  if (targetLanguage) return targetLanguage;
  return speaker === "staff" ? patientLanguage : "ko";
}

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid feedback payload" }, { status: 400 });
  }

  const limited = await rateLimit({
    key: `translation-feedback:${clientIp(request)}:${parsed.data.roomId}`,
    limit: 20,
    windowMs: 60 * 1000
  });
  if (!limited.ok) return rateLimitResponse(limited.retryAfter);

  const room = await prisma.translationRoom.findUnique({
    where: { id: parsed.data.roomId },
    select: {
      id: true,
      hospitalId: true,
      hostStaffId: true,
      roomToken: true,
      patientLanguage: true
    }
  });
  if (!room) return NextResponse.json({ error: "Room not found" }, { status: 404 });

  if (parsed.data.reporterRole === "staff") {
    const staff = await getCurrentStaff();
    if (!staff || (staff.id !== room.hostStaffId && staff.hospitalId !== room.hospitalId)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  } else if (!(await isPatientRoomRequestAuthorized(room, parsed.data.roomToken ?? request.headers.get("x-room-token") ?? undefined))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const message = await prisma.consultationMessage.findFirst({
    where: {
      id: parsed.data.messageId,
      roomId: room.id
    }
  });
  if (!message) return NextResponse.json({ error: "Message not found" }, { status: 404 });

  const feedback = await prisma.translationFeedback.create({
    data: {
      hospitalId: room.hospitalId,
      roomId: room.id,
      messageId: message.id,
      sourceText: message.sourceText?.trim() || message.text,
      translatedText: message.text,
      sourceLanguage: sourceLanguageForMessage(message.speaker, room.patientLanguage),
      targetLanguage: targetLanguageForMessage(message.speaker, room.patientLanguage, message.targetLanguage),
      reporterRole: parsed.data.reporterRole,
      reason: parsed.data.reason ?? null
    }
  });

  return NextResponse.json({
    feedback: {
      id: feedback.id,
      status: feedback.status,
      createdAt: feedback.createdAt.toISOString()
    }
  });
}
