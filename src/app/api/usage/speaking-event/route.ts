import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentStaff } from "@/lib/session";
import { clientIp, rateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { isPatientRoomRequestAuthorized } from "@/lib/patient-room-session";

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

  const limited = await rateLimit({
    key: `speaking-event:${clientIp(request)}:${parsed.data.roomId}:${parsed.data.role}`,
    limit: 30,
    windowMs: 60 * 1000
  });
  if (!limited.ok) {
    return rateLimitResponse(limited.retryAfter);
  }

  const room = await prisma.translationRoom.findUnique({
    where: { id: parsed.data.roomId },
    select: {
      id: true,
      hostStaffId: true,
      roomToken: true,
      endedAt: true,
      usageSession: { select: { id: true, roomStartedAt: true, roomEndedAt: true } }
    }
  });
  if (!room || !room.usageSession) return NextResponse.json({ error: "Room not found" }, { status: 404 });

  if (parsed.data.role === "staff") {
    const staff = await getCurrentStaff();
    if (!staff || staff.id !== room.hostStaffId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  } else if (!(await isPatientRoomRequestAuthorized(room, parsed.data.roomToken))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const durationSeconds = Math.max(0, Math.round(parsed.data.durationSeconds));
  const now = new Date();
  const usageEndedAt = room.usageSession.roomEndedAt ?? room.endedAt ?? now;
  const usageEndTime = Math.min(usageEndedAt.getTime(), now.getTime());
  const elapsedRoomSeconds = Math.max(0, Math.ceil((usageEndTime - room.usageSession.roomStartedAt.getTime()) / 1000));
  const maxCredibleSpeakingSeconds = elapsedRoomSeconds + 30;
  const speakingColumn =
    parsed.data.role === "staff" ? Prisma.sql`"staffSpeakingSeconds"` : Prisma.sql`"patientSpeakingSeconds"`;

  const [usage] = await prisma.$queryRaw<Array<Record<string, unknown>>>(Prisma.sql`
    UPDATE "UsageSession"
    SET ${speakingColumn} = LEAST(COALESCE(${speakingColumn}, 0) + ${durationSeconds}, ${maxCredibleSpeakingSeconds})
    WHERE "roomId" = ${room.id}
    RETURNING *
  `);

  return NextResponse.json({ usage });
}
