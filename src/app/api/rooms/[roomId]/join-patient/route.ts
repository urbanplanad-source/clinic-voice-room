import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  roomToken: z.string().min(16)
});

export async function POST(request: Request, context: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await context.params;
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid join payload" }, { status: 400 });
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
