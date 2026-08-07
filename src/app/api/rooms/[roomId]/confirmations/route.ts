import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentStaff } from "@/lib/session";
import { parseGuardFlags } from "@/lib/guard-flags";

export async function GET(_: Request, context: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await context.params;
  const staff = await getCurrentStaff();
  if (!staff) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const room = await prisma.translationRoom.findUnique({
    where: { id: roomId },
    select: { hostStaffId: true }
  });
  if (!room || room.hostStaffId !== staff.id) return NextResponse.json({ error: "Room not found" }, { status: 404 });

  const messages = await prisma.consultationMessage.findMany({
    where: { roomId, speaker: "staff", guardFlags: { not: { equals: null } } },
    orderBy: { createdAt: "desc" },
    take: 80,
    select: { id: true, guardFlags: true }
  });

  return NextResponse.json({
    confirmations: messages.flatMap((message) => {
      const confirmation = parseGuardFlags(message.guardFlags)?.confirmation;
      return confirmation ? [{ messageId: message.id, ...confirmation }] : [];
    })
  });
}
