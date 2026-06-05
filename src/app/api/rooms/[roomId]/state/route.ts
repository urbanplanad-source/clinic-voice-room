import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentStaff } from "@/lib/session";
import { isPatientRoomRequestAuthorized } from "@/lib/patient-room-session";
import { canRoleRequestStatus, canTransition, isRoomStatus, type RoomStatus } from "@/lib/room-state";
import { staffRoomSelect } from "@/lib/room-response";

const schema = z.object({
  role: z.enum(["staff", "patient"]),
  status: z.string().refine(isRoomStatus),
  roomToken: z.string().optional()
});

export async function POST(request: Request, context: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await context.params;
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid state payload" }, { status: 400 });
  }

  const room = await prisma.translationRoom.findUnique({ where: { id: roomId } });
  if (!room) return NextResponse.json({ error: "Room not found" }, { status: 404 });
  if (room.status === "ended") return NextResponse.json({ error: "Room already ended" }, { status: 409 });

  if (parsed.data.role === "staff") {
    const staff = await getCurrentStaff();
    if (!staff || staff.id !== room.hostStaffId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  } else if (!(await isPatientRoomRequestAuthorized(room, parsed.data.roomToken))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const nextStatus = parsed.data.status as RoomStatus;

  if (!canRoleRequestStatus(parsed.data.role, nextStatus)) {
    return NextResponse.json({ error: "Role cannot request this state" }, { status: 403 });
  }

  if (!canTransition(room.status, nextStatus)) {
    const currentRoom = await prisma.translationRoom.findUnique({
      where: { id: roomId },
      select: staffRoomSelect
    });
    return NextResponse.json({ error: `Invalid transition ${room.status} -> ${nextStatus}`, room: currentRoom }, { status: 409 });
  }

  const result = await prisma.translationRoom.updateMany({
    where: { id: roomId, status: room.status },
    data: { status: nextStatus, lastActiveAt: new Date() }
  });

  const updated = await prisma.translationRoom.findUnique({
    where: { id: roomId },
    select: staffRoomSelect
  });

  if (!updated) {
    return NextResponse.json({ error: "Room not found" }, { status: 404 });
  }

  if (result.count === 0) {
    return NextResponse.json({ error: "Room state changed", room: updated }, { status: 409 });
  }

  return NextResponse.json({ room: updated });
}
