import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentStaff } from "@/lib/session";
import { isPatientLanguage } from "@/lib/languages";

const supportedVoices = ["alloy", "ash", "ballad", "coral", "echo", "fable", "onyx", "nova", "sage", "shimmer", "verse"] as const;
type SupportedVoice = (typeof supportedVoices)[number];

const schema = z.object({
  roomId: z.string(),
  roomToken: z.string().optional(),
  role: z.enum(["staff", "patient"]),
  patientLanguage: z.string().refine(isPatientLanguage),
  text: z.string().trim().min(1).max(1000)
});

const languageNames: Record<string, string> = {
  ko: "Korean",
  zh: "Mandarin Chinese",
  ja: "Japanese",
  en: "English",
  ru: "Russian",
  vi: "Vietnamese",
  id: "Indonesian",
  fr: "French",
  es: "Spanish",
  de: "German",
  it: "Italian",
  pt: "Portuguese"
};

const languageVoiceDefaults: Record<string, SupportedVoice> = {
  ko: "shimmer",
  zh: "nova",
  ja: "sage",
  en: "coral",
  ru: "onyx",
  vi: "verse",
  id: "alloy",
  fr: "fable",
  es: "nova",
  de: "onyx",
  it: "verse",
  pt: "sage"
};

function voiceFor(language: string) {
  const configured = process.env[`OPENAI_TTS_VOICE_${language.toUpperCase()}`] ?? process.env.OPENAI_TTS_VOICE;
  if (configured && supportedVoices.includes(configured as SupportedVoice)) {
    return configured as SupportedVoice;
  }
  return languageVoiceDefaults[language] ?? "alloy";
}

function instructionsFor(language: string, role: "staff" | "patient") {
  const languageName = languageNames[language] ?? "the requested language";
  const listener = role === "staff" ? "a Korean hospital staff member wearing an earphone" : "a patient lying down during a procedure";

  return [
    `The input text is already written in ${languageName}.`,
    `Speak only in ${languageName} with a native ${languageName} accent and natural ${languageName} pronunciation.`,
    "Do not pronounce the text with an English or Korean accent unless the word is an English brand name.",
    "Keep brand names and device names recognizable, but read all normal words with the target-language accent.",
    `Use a calm, clear clinic guidance tone for ${listener}.`,
    "Speak slightly slowly, with short pauses suitable for a live medical procedure."
  ].join(" ");
}

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

  const speechLanguage = parsed.data.role === "staff" ? "ko" : parsed.data.patientLanguage;
  const model = process.env.OPENAI_TTS_MODEL ?? "gpt-4o-mini-tts";
  const voice = voiceFor(speechLanguage);
  const instructions = instructionsFor(speechLanguage, parsed.data.role);

  const response = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "OpenAI-Safety-Identifier": `clinic-voice-room-tts-${parsed.data.role}`
    },
    body: JSON.stringify({
      model,
      voice,
      input: parsed.data.text,
      instructions,
      response_format: "mp3",
      speed: 0.9
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
      "Cache-Control": "no-store",
      "X-CVR-TTS-Provider": "openai-audio-speech",
      "X-CVR-TTS-Model": model,
      "X-CVR-TTS-Voice": voice,
      "X-CVR-TTS-Language": speechLanguage,
      "X-CVR-TTS-Version": "ai-tts-only-2026-05-19.2"
    }
  });
}
