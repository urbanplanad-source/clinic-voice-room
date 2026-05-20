import { NextResponse } from "next/server";
import { getCurrentStaff } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { endStaleRooms } from "@/lib/stale-rooms";

export async function GET(_: Request, context: { params: Promise<{ roomId: string }> }) {
  const staff = await getCurrentStaff();
  if (!staff) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { roomId } = await context.params;
  await endStaleRooms({ hospitalId: staff.hospitalId });

  const room = await prisma.translationRoom.findFirst({
    where: {
      id: roomId,
      OR: [{ hostStaffId: staff.id }, { hospitalId: staff.hospitalId }]
    },
    include: { hospital: true, hostStaff: true, usageSession: true, participants: true }
  });

  if (!room) {
    return NextResponse.json({ error: "Room not found" }, { status: 404 });
  }

  return NextResponse.json({ room });
}
