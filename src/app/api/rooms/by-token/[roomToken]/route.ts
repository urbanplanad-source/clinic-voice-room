import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { clientIp, rateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { legacyRoomTokenAccessEnabled } from "@/lib/legacy-room-token";

export async function GET(request: Request, context: { params: Promise<{ roomToken: string }> }) {
  if (!legacyRoomTokenAccessEnabled()) {
    return NextResponse.json({ error: "Legacy room token lookup is disabled" }, { status: 410 });
  }

  const { roomToken } = await context.params;
  const limited = await rateLimit({
    key: `room-token-lookup:${clientIp(request)}:${roomToken.slice(0, 12)}`,
    limit: 120,
    windowMs: 60 * 1000
  });
  if (!limited.ok) {
    return rateLimitResponse(limited.retryAfter);
  }

  const room = await prisma.translationRoom.findUnique({
    where: { roomToken },
    select: {
      id: true,
      patientLanguage: true,
      roomMode: true,
      status: true,
      createdAt: true,
      patientJoinedAt: true,
      endedAt: true,
      hospital: {
        select: { name: true }
      }
    }
  });

  if (!room || room.status === "ended") {
    return NextResponse.json({ error: "Room not available" }, { status: 404 });
  }

  return NextResponse.json({
    room: {
      id: room.id,
      hospital: {
        name: room.hospital.name
      },
      patientLanguage: room.patientLanguage,
      roomMode: room.roomMode,
      status: room.status,
      createdAt: room.createdAt,
      patientJoinedAt: room.patientJoinedAt,
      endedAt: room.endedAt
    }
  });
}
