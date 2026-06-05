import { NextResponse } from "next/server";
import { getCurrentStaff } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { staffRoomSelect } from "@/lib/room-response";
import { ensurePatientJoinCode } from "@/lib/patient-join-code";

export async function GET(_: Request, context: { params: Promise<{ roomId: string }> }) {
  const staff = await getCurrentStaff();
  if (!staff) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { roomId } = await context.params;
  const room = await prisma.translationRoom.findFirst({
    where: {
      id: roomId,
      OR: [{ hostStaffId: staff.id }, { hospitalId: staff.hospitalId }]
    },
    select: staffRoomSelect
  });

  if (!room) {
    return NextResponse.json({ error: "Room not found" }, { status: 404 });
  }

  return NextResponse.json({
    room: {
      ...room,
      patientJoinCode: await ensurePatientJoinCode(room)
    }
  });
}
