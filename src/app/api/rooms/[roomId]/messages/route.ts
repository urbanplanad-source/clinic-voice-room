import { NextResponse } from "next/server";
import { getCurrentStaff } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { isPatientRoomRequestAuthorized } from "@/lib/patient-room-session";
import { parseGuardFlags } from "@/lib/guard-flags";

export async function GET(request: Request, context: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await context.params;
  const url = new URL(request.url);
  const roomToken = request.headers.get("x-room-token");
  const after = url.searchParams.get("after");

  const room = await prisma.translationRoom.findUnique({
    where: { id: roomId },
    select: { id: true, hostStaffId: true, roomToken: true, status: true }
  });
  if (!room) {
    return NextResponse.json({ error: "Room not found" }, { status: 404 });
  }

  const staff = await getCurrentStaff();
  const staffAllowed = Boolean(staff && staff.id === room.hostStaffId);
  const patientAllowed = await isPatientRoomRequestAuthorized(room, roomToken);
  if (!staffAllowed && !patientAllowed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const afterDate = after ? new Date(after) : null;
  const messages = await prisma.consultationMessage.findMany({
    where: {
      roomId: room.id,
      createdAt: afterDate && !Number.isNaN(afterDate.getTime()) ? { gt: afterDate } : undefined
    },
    orderBy: { createdAt: afterDate && !Number.isNaN(afterDate.getTime()) ? "asc" : "desc" },
    take: 80
  });
  const orderedMessages = afterDate && !Number.isNaN(afterDate.getTime()) ? messages : [...messages].reverse();

  return NextResponse.json({
    messages: orderedMessages.map((message) => ({
      id: message.id,
      speaker: message.speaker,
      sourceText: message.sourceText,
      text: message.text,
      targetLanguage: message.targetLanguage,
      createdAt: message.createdAt.toISOString(),
      readAt: message.readAt?.toISOString() ?? null,
      guardFlags: parseGuardFlags(message.guardFlags) ?? null
    }))
  });
}
