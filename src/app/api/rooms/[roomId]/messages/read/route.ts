import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentStaff } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { isPatientRoomRequestAuthorized } from "@/lib/patient-room-session";

const schema = z.object({
  roomToken: z.string().optional()
});

export async function POST(request: Request, context: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await context.params;
  const body = await request.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid read payload" }, { status: 400 });
  }

  const roomToken = request.headers.get("x-room-token") ?? parsed.data.roomToken;
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

  const viewerRole = staffAllowed ? "staff" : "patient";
  const result = await prisma.consultationMessage.updateMany({
    where: {
      roomId: room.id,
      speaker: viewerRole === "staff" ? "patient" : "staff",
      readAt: null
    },
    data: { readAt: new Date() }
  });

  return NextResponse.json({ updatedCount: result.count });
}
