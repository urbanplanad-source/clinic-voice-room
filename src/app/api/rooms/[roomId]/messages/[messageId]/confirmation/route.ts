import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { parseGuardFlags } from "@/lib/guard-flags";
import { isPatientRoomRequestAuthorized } from "@/lib/patient-room-session";
import { broadcastServerTranslationMessage } from "@/lib/supabase-realtime-server";
import type { PatientLanguage } from "@/lib/languages";
import { clientIp, rateLimit, rateLimitResponse } from "@/lib/rate-limit";

const schema = z.object({
  status: z.enum(["confirmed", "repeat_requested"])
});

export async function POST(
  request: Request,
  context: { params: Promise<{ roomId: string; messageId: string }> }
) {
  const { roomId, messageId } = await context.params;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid confirmation status" }, { status: 400 });
  const limited = await rateLimit({ key: `patient-confirmation:${clientIp(request)}:${roomId}`, limit: 20, windowMs: 60_000 });
  if (!limited.ok) return rateLimitResponse(limited.retryAfter);

  const room = await prisma.translationRoom.findUnique({
    where: { id: roomId },
    select: { id: true, roomToken: true, status: true }
  });
  if (!room || room.status === "ended") return NextResponse.json({ error: "Room not available" }, { status: 404 });
  if (!(await isPatientRoomRequestAuthorized(room, request.headers.get("x-room-token")))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const existing = await prisma.consultationMessage.findFirst({
    where: { id: messageId, roomId, speaker: "staff" }
  });
  if (!existing) return NextResponse.json({ error: "Message not found" }, { status: 404 });

  const guardFlags = parseGuardFlags(existing.guardFlags);
  if (!guardFlags?.confirmation?.required) {
    return NextResponse.json({ error: "Confirmation is not required for this message" }, { status: 409 });
  }

  const nextGuardFlags = {
    ...guardFlags,
    confirmation: {
      ...guardFlags.confirmation,
      status: parsed.data.status,
      respondedAt: new Date().toISOString()
    }
  };
  const updated = await prisma.consultationMessage.update({
    where: { id: existing.id },
    data: { guardFlags: nextGuardFlags as Prisma.InputJsonObject }
  });

  const message = {
    id: updated.id,
    speaker: updated.speaker,
    sourceText: updated.sourceText ?? undefined,
    text: updated.text,
    targetLanguage: (updated.targetLanguage ?? undefined) as PatientLanguage | "ko" | undefined,
    createdAt: updated.createdAt.toISOString(),
    readAt: updated.readAt?.toISOString() ?? null,
    guardFlags: nextGuardFlags
  };
  await broadcastServerTranslationMessage(room.id, message).catch((caught) => {
    console.error("[patient confirmation broadcast]", caught);
  });

  return NextResponse.json({ message });
}
