import { NextResponse } from "next/server";
import { getCurrentStaff } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request, context: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await context.params;
  const url = new URL(request.url);
  const roomToken = url.searchParams.get("roomToken");
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
  const patientAllowed = Boolean(roomToken && roomToken === room.roomToken);
  if (!staffAllowed && !patientAllowed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const viewerRole = staffAllowed ? "staff" : "patient";

  await prisma.consultationMessage.updateMany({
    where: {
      roomId: room.id,
      speaker: viewerRole === "staff" ? "patient" : "staff",
      readAt: null
    },
    data: { readAt: new Date() }
  });

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
      text: message.text,
      createdAt: message.createdAt.toISOString(),
      readAt: message.readAt?.toISOString() ?? null
    }))
  });
}
