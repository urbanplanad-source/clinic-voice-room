import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentStaff } from "@/lib/session";
import { quickPhraseStages } from "@/lib/quick-phrases";

const querySchema = z.object({
  stage: z.enum(quickPhraseStages).optional()
});

function translationForLanguage(translations: unknown, language: string) {
  if (!translations || typeof translations !== "object" || Array.isArray(translations)) return null;
  const value = (translations as Record<string, unknown>)[language];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export async function GET(request: Request, context: { params: Promise<{ roomId: string }> }) {
  const staff = await getCurrentStaff();
  if (!staff) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { roomId } = await context.params;
  const parsed = querySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  const stage = parsed.success ? parsed.data.stage : undefined;

  const room = await prisma.translationRoom.findUnique({
    where: { id: roomId },
    select: {
      id: true,
      hospitalId: true,
      hostStaffId: true,
      patientLanguage: true,
      status: true,
      roomMode: true
    }
  });

  if (!room || room.status === "ended" || room.roomMode !== "consultation") {
    return NextResponse.json({ error: "Room not available" }, { status: 404 });
  }
  if (staff.id !== room.hostStaffId && staff.hospitalId !== room.hospitalId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const phrases = await prisma.hospitalQuickPhrase.findMany({
    where: {
      hospitalId: room.hospitalId,
      isActive: true,
      ...(stage ? { OR: [{ stage }, { stage: null }] } : {})
    },
    orderBy: [{ sortOrder: "asc" }, { updatedAt: "desc" }],
    take: 100
  });

  return NextResponse.json({
    patientLanguage: room.patientLanguage,
    phrases: phrases.map((phrase) => ({
      id: phrase.id,
      stage: phrase.stage,
      ko: phrase.ko,
      translatedText: translationForLanguage(phrase.translations, room.patientLanguage),
      sortOrder: phrase.sortOrder
    }))
  });
}
