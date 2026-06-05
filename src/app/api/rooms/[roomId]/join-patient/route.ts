import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { clientIp, rateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { setPatientRoomSession } from "@/lib/patient-room-session";
import { legacyRoomTokenAccessEnabled } from "@/lib/legacy-room-token";

const schema = z.object({
  joinCode: z.string().min(16).optional(),
  roomToken: z.string().min(16).optional()
}).refine((value) => Boolean(value.joinCode || value.roomToken));

export async function POST(request: Request, context: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await context.params;
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid join payload" }, { status: 400 });
  }

  const joinCredential = parsed.data.joinCode ?? parsed.data.roomToken ?? "";
  const credentialWhere = legacyRoomTokenAccessEnabled()
    ? [{ patientJoinCode: joinCredential }, { roomToken: joinCredential }]
    : [{ patientJoinCode: joinCredential }];
  const limited = await rateLimit({
    key: `room-token-join:${clientIp(request)}:${joinCredential.slice(0, 12)}`,
    limit: 20,
    windowMs: 10 * 60 * 1000
  });
  if (!limited.ok) {
    return rateLimitResponse(limited.retryAfter);
  }

  const room = await prisma.translationRoom.findFirst({
    where: {
      id: roomId,
      OR: credentialWhere
    },
    include: { participants: true }
  });

  if (!room || room.status === "ended") {
    return NextResponse.json({ error: "Room not available" }, { status: 404 });
  }

  const joinedAt = new Date();
  const existingPatient = room.participants.find((participant) => participant.role === "patient" && !participant.leftAt);
  const updated = await prisma.translationRoom.update({
    where: { id: room.id },
    data: {
      patientJoinedAt: room.patientJoinedAt ?? joinedAt,
      lastActiveAt: joinedAt,
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
    select: {
      id: true,
      roomToken: true,
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

  await setPatientRoomSession({ id: updated.id, roomToken: updated.roomToken, status: updated.status });

  return NextResponse.json({
    room: {
      id: updated.id,
      patientLanguage: updated.patientLanguage,
      roomMode: updated.roomMode,
      status: updated.status,
      createdAt: updated.createdAt,
      patientJoinedAt: updated.patientJoinedAt,
      endedAt: updated.endedAt,
      hospital: updated.hospital
    }
  });
}
