import { NextResponse } from "next/server";
import { getCurrentStaff } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { secondsBetween } from "@/lib/usage";
import { staffRoomSelect } from "@/lib/room-response";

export async function POST(_: Request, context: { params: Promise<{ roomId: string }> }) {
  const staff = await getCurrentStaff();
  if (!staff) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { roomId } = await context.params;
  const room = await prisma.translationRoom.findFirst({
    where: { id: roomId, hostStaffId: staff.id },
    include: { usageSession: true }
  });

  if (!room) return NextResponse.json({ error: "Room not found" }, { status: 404 });

  const endedAt = room.endedAt ?? new Date();
  const updated = await prisma.$transaction(async (tx) => {
    await tx.consultationMessage.deleteMany({ where: { roomId: room.id } });

    return tx.translationRoom.update({
      where: { id: room.id },
      data: {
        status: "ended",
        endedAt,
        lastActiveAt: endedAt,
        usageSession: room.usageSession
          ? {
              update: {
                roomEndedAt: endedAt,
                totalRoomSeconds: secondsBetween(room.usageSession.roomStartedAt, endedAt)
              }
            }
          : undefined
      },
      select: staffRoomSelect
    });
  });

  return NextResponse.json({ room: updated });
}
