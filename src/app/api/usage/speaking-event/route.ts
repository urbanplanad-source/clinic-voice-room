import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentStaff } from "@/lib/session";

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
    select: {
      id: true,
      hostStaffId: true,
      roomToken: true,
      usageSession: { select: { id: true } }
    }
  });
  if (!room || !room.usageSession) return NextResponse.json({ error: "Room not found" }, { status: 404 });

  if (parsed.data.role === "staff") {
    const staff = await getCurrentStaff();
    if (!staff || staff.id !== room.hostStaffId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  } else if (parsed.data.roomToken !== room.roomToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const durationSeconds = Math.max(0, Math.round(parsed.data.durationSeconds));
  const speakingColumn =
    parsed.data.role === "staff" ? Prisma.sql`"staffSpeakingSeconds"` : Prisma.sql`"patientSpeakingSeconds"`;

  const [usage] = await prisma.$queryRaw<Array<Record<string, unknown>>>(Prisma.sql`
    UPDATE "UsageSession"
    SET ${speakingColumn} = COALESCE(${speakingColumn}, 0) + ${durationSeconds}
    WHERE "roomId" = ${room.id}
    RETURNING *
  `);

  return NextResponse.json({ usage });
}
