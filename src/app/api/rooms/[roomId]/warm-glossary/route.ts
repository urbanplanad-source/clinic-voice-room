import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentStaff } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { isPatientRoomRequestAuthorized } from "@/lib/patient-room-session";
import { glossarySource, warmGlossaryForHospital } from "@/lib/glossary-service";

const schema = z.object({
  roomToken: z.string().optional()
});

export async function POST(request: Request, context: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await context.params;
  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  const bodyRoomToken = parsed.success ? parsed.data.roomToken : undefined;
  const headerRoomToken = request.headers.get("x-room-token") ?? undefined;

  const room = await prisma.translationRoom.findUnique({
    where: { id: roomId },
    select: {
      id: true,
      hostStaffId: true,
      hospitalId: true,
      roomToken: true,
      status: true,
      hospital: { select: { specialty: true } }
    }
  });

  if (!room || room.status === "ended") {
    return NextResponse.json({ error: "Room not available" }, { status: 404 });
  }

  const staff = await getCurrentStaff();
  const staffAllowed = Boolean(staff && (staff.id === room.hostStaffId || staff.hospitalId === room.hospitalId));
  const patientAllowed = staffAllowed ? false : await isPatientRoomRequestAuthorized(room, headerRoomToken ?? bodyRoomToken);
  if (!staffAllowed && !patientAllowed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await warmGlossaryForHospital(room.hospitalId, room.hospital.specialty);
  return NextResponse.json({ ok: true, source: glossarySource() });
}
