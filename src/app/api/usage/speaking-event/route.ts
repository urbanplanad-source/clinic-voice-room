import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentStaff } from "@/lib/session";
import { addDuration } from "@/lib/usage";

const schema = z.object({
  roomId: z.string(),
  role: z.enum(["staff", "patient"]),
  durationSeconds: z.number().min(0).max(60 * 30),
  roomToken: z.string().optional()
});

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid usage event" }, { status: 400 });
  }

  const room = await prisma.translationRoom.findUnique({
    where: { id: parsed.data.roomId },
    include: { usageSession: true }
  });
  if (!room || !room.usageSession) return NextResponse.json({ error: "Room not found" }, { status: 404 });

  if (parsed.data.role === "staff") {
    const staff = await getCurrentStaff();
    if (!staff || staff.id !== room.hostStaffId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  } else if (parsed.data.roomToken !== room.roomToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const data =
    parsed.data.role === "staff"
      ? { staffSpeakingSeconds: addDuration(room.usageSession.staffSpeakingSeconds, parsed.data.durationSeconds) }
      : { patientSpeakingSeconds: addDuration(room.usageSession.patientSpeakingSeconds, parsed.data.durationSeconds) };

  const usage = await prisma.usageSession.update({
    where: { roomId: room.id },
    data
  });

  return NextResponse.json({ usage });
}
