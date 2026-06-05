import { NextResponse } from "next/server";
import { isPatientRoomSessionAuthorized } from "@/lib/patient-room-session";
import { prisma } from "@/lib/prisma";

export async function GET(_: Request, context: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await context.params;
  const room = await prisma.translationRoom.findUnique({
    where: { id: roomId },
    select: {
      id: true,
      roomToken: true,
      patientLanguage: true,
      roomMode: true,
      status: true,
      createdAt: true,
      patientJoinedAt: true,
      endedAt: true,
      hospital: { select: { name: true } }
    }
  });

  if (!room || !(await isPatientRoomSessionAuthorized(room))) {
    return NextResponse.json({ error: "Room not available" }, { status: 404 });
  }

  return NextResponse.json({
    room: {
      id: room.id,
      hospital: { name: room.hospital.name },
      patientLanguage: room.patientLanguage,
      roomMode: room.roomMode,
      status: room.status,
      createdAt: room.createdAt,
      patientJoinedAt: room.patientJoinedAt,
      endedAt: room.endedAt
    }
  });
}
