import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(_: Request, context: { params: Promise<{ roomToken: string }> }) {
  const { roomToken } = await context.params;
  const room = await prisma.translationRoom.findUnique({
    where: { roomToken },
    include: { hospital: true, hostStaff: true, participants: true }
  });

  if (!room || room.status === "ended") {
    return NextResponse.json({ error: "Room not available" }, { status: 404 });
  }

  return NextResponse.json({
    room: {
      id: room.id,
      hospital: room.hospital,
      patientLanguage: room.patientLanguage,
      status: room.status,
      createdAt: room.createdAt,
      patientJoinedAt: room.patientJoinedAt,
      endedAt: room.endedAt
    }
  });
}
