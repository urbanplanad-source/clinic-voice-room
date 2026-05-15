import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentStaff } from "@/lib/session";
import { isPatientLanguage } from "@/lib/languages";

const schema = z.object({
  roomId: z.string(),
  roomToken: z.string().optional(),
  role: z.enum(["staff", "patient"]),
  patientLanguage: z.string().refine(isPatientLanguage),
  text: z.string().trim().min(1).max(1000)
});

const languageVoiceHints: Record<string, string> = {
  ko: "Speak in natural Korean with a calm, clear clinic guidance tone. Keep the pace easy for a doctor wearing an earphone during a procedure.",
  zh: "Speak in natural Mandarin Chinese with a calm, clear clinic guidance tone. Keep the pace easy for a patient lying down during a procedure.",
  ja: "Speak in natural Japanese with a calm, clear clinic guidance tone. Keep the pace easy for a patient lying down during a procedure.",
  en: "Speak in natural English with a calm, clear clinic guidance tone. Keep the pace easy for a patient lying down during a procedure.",
  ru: "Speak in natural Russian with a calm, clear clinic guidance tone. Keep the pace easy for a patient lying down during a procedure.",
  vi: "Speak in natural Vietnamese with a calm, clear clinic guidance tone. Keep the pace easy for a patient lying down during a procedure.",
  id: "Speak in natural Indonesian with a calm, clear clinic guidance tone. Keep the pace easy for a patient lying down during a procedure."
};

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid speech request" }, { status: 400 });
  }

  const room = await prisma.translationRoom.findUnique({ where: { id: parsed.data.roomId } });
  if (!room || room.status === "ended" || room.patientLanguage !== parsed.data.patientLanguage) {
    return NextResponse.json({ error: "Room not available" }, { status: 404 });
  }

  if (parsed.data.role === "staff") {
    const staff = await getCurrentStaff();
    if (!staff || staff.id !== room.hostStaffId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  } else if (parsed.data.roomToken !== room.roomToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "OPENAI_API_KEY is not configured" }, { status: 500 });
  }

  const response = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "OpenAI-Safety-Identifier": `clinic-voice-room-tts-${parsed.data.role}`
    },
    body: JSON.stringify({
      model: process.env.OPENAI_TTS_MODEL ?? "gpt-4o-mini-tts",
      voice: process.env.OPENAI_TTS_VOICE ?? "marin",
      input: parsed.data.text,
      instructions: languageVoiceHints[parsed.data.role === "staff" ? "ko" : parsed.data.patientLanguage],
      response_format: "mp3",
      speed: 0.95
    })
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    console.error("[tts]", response.status, detail);
    return NextResponse.json({ error: "Translated speech could not be created" }, { status: 502 });
  }

  return new NextResponse(response.body, {
    status: 200,
    headers: {
      "Content-Type": "audio/mpeg",
      "Cache-Control": "no-store"
    }
  });
}
