import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { clientIp, rateLimit, rateLimitResponse } from "@/lib/rate-limit";

const schema = z.object({
  roomToken: z.string().min(16)
});

export async function POST(request: Request, context: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await context.params;
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid join payload" }, { status: 400 });
  }

  const limited = rateLimit({
    key: `room-token-join:${clientIp(request)}:${parsed.data.roomToken.slice(0, 12)}`,
    limit: 20,
    windowMs: 10 * 60 * 1000
  });
  if (!limited.ok) {
    return rateLimitResponse(limited.retryAfter);
  }

  const room = await prisma.translationRoom.findFirst({
    where: { id: roomId, roomToken: parsed.data.roomToken },
    include: { participants: true }
  });

  if (!room || room.status === "ended") {
    return NextResponse.json({ error: "Room not available" }, { status: 404 });
  }

  const existingPatient = room.participants.find((participant) => participant.role === "patient" && !participant.leftAt);
  const updated = await prisma.translationRoom.update({
    where: { id: room.id },
    data: {
      patientJoinedAt: room.patientJoinedAt ?? new Date(),
      status: room.status === "waiting_for_patient" ? "ready" : room.status,
      participants: existingPatient
        ? undefined
        : {
            create: {
              role: "patient",
              connectionState: "connected"
            }
          }
    },
    include: { hospital: true, participants: true }
  });

  return NextResponse.json({ room: updated });
}
