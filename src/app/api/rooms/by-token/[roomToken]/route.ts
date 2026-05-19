import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { clientIp, rateLimit, rateLimitResponse } from "@/lib/rate-limit";

export async function GET(request: Request, context: { params: Promise<{ roomToken: string }> }) {
  const { roomToken } = await context.params;
  const limited = rateLimit({
    key: `room-token-lookup:${clientIp(request)}:${roomToken.slice(0, 12)}`,
    limit: 120,
    windowMs: 60 * 1000
  });
  if (!limited.ok) {
    return rateLimitResponse(limited.retryAfter);
  }

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
