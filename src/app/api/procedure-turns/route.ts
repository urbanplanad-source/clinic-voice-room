import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentStaff } from "@/lib/session";
import { clientIp, rateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { buildClinicGlossaryInstructions, normalizeClinicTranslation } from "@/lib/clinic-glossary";
import { isPatientLanguage, languageLabels, sourceTargetFor, type ParticipantRole, type PatientLanguage } from "@/lib/languages";

type TargetLanguage = PatientLanguage | "ko";

type TranscriptionResponse = {
  text?: string;
};

type ResponsesApiContent = {
  type?: string;
  text?: string;
};

type ResponsesApiOutputItem = {
  type?: string;
  content?: ResponsesApiContent[];
};

type ResponsesApiResponse = {
  output_text?: string;
  output?: ResponsesApiOutputItem[];
};

function extractOutputText(data: ResponsesApiResponse) {
  if (typeof data.output_text === "string") return data.output_text.trim();

  return (
    data.output
      ?.flatMap((item) => item.content ?? [])
      .map((content) => content.text)
      .filter((text): text is string => typeof text === "string")
      .join("")
      .trim() ?? ""
  );
}

function textField(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function transcriptionLanguageFor(role: ParticipantRole, patientLanguage: PatientLanguage) {
  return role === "staff" ? "ko" : patientLanguage;
}

export async function POST(request: Request) {
  const formData = await request.formData().catch(() => null);
  if (!formData) {
    return NextResponse.json({ error: "Invalid procedure turn payload" }, { status: 400 });
  }

  const roomId = textField(formData, "roomId");
  const roomToken = textField(formData, "roomToken");
  const clientTurnId = textField(formData, "clientTurnId");
  const role = textField(formData, "role") as ParticipantRole;
  const patientLanguage = textField(formData, "patientLanguage");
  const audio = formData.get("audio");

  if (!roomId || !clientTurnId || (role !== "staff" && role !== "patient") || !isPatientLanguage(patientLanguage) || !(audio instanceof File)) {
    return NextResponse.json({ error: "Invalid procedure turn payload" }, { status: 400 });
  }

  if (audio.size <= 0 || audio.size > 15 * 1024 * 1024) {
    return NextResponse.json({ error: "Audio turn is empty or too large" }, { status: 413 });
  }

  const limited = rateLimit({
    key: `procedure-turn:${clientIp(request)}:${roomId}:${role}`,
    limit: 30,
    windowMs: 60 * 1000
  });
  if (!limited.ok) {
    return rateLimitResponse(limited.retryAfter);
  }

  const room = await prisma.translationRoom.findUnique({ where: { id: roomId } });
  if (!room || room.status === "ended" || room.patientLanguage !== patientLanguage) {
    return NextResponse.json({ error: "Room not available" }, { status: 404 });
  }

  if (role === "staff") {
    const staff = await getCurrentStaff();
    if (!staff || staff.id !== room.hostStaffId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  } else if (roomToken !== room.roomToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "OPENAI_API_KEY is not configured" }, { status: 500 });
  }

  const transcriptionForm = new FormData();
  transcriptionForm.set("file", audio, audio.name || `${clientTurnId}.webm`);
  transcriptionForm.set("model", process.env.OPENAI_TRANSCRIPTION_MODEL ?? "gpt-4o-mini-transcribe");
  transcriptionForm.set("language", transcriptionLanguageFor(role, patientLanguage));
  transcriptionForm.set("response_format", "json");

  const transcriptionResponse = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "OpenAI-Safety-Identifier": `clinic-voice-room-procedure-stt-${room.id}-${role}`
    },
    body: transcriptionForm
  });

  if (!transcriptionResponse.ok) {
    const detail = await transcriptionResponse.text().catch(() => "");
    console.error("[procedure-turns transcription]", transcriptionResponse.status, detail);
    return NextResponse.json({ error: "Audio transcription failed" }, { status: 502 });
  }

  const transcriptionData = (await transcriptionResponse.json()) as TranscriptionResponse;
  const sourceText = transcriptionData.text?.trim();
  if (!sourceText) {
    return NextResponse.json({ error: "No speech was transcribed" }, { status: 422 });
  }

  const direction = sourceTargetFor(role, patientLanguage);
  const targetLanguage: TargetLanguage = role === "staff" ? patientLanguage : "ko";
  const targetLabel = targetLanguage === "ko" ? "Korean" : languageLabels[patientLanguage].english;
  const model = process.env.OPENAI_TEXT_TRANSLATION_MODEL ?? "gpt-5.5";
  const instructions = [
    "You are a professional medical interpreter for a dermatology and plastic surgery procedure room.",
    "Translate the user's short spoken procedure-room message accurately and naturally.",
    `Target language: ${targetLabel}.`,
    direction.instructions,
    "Preserve clinical meaning, urgency, numbers, body parts, and safety instructions.",
    "Do not add advice, diagnosis, consent language, labels, quotes, markdown, or commentary.",
    "Return only the translated text.",
    buildClinicGlossaryInstructions(patientLanguage)
  ].join("\n");

  const translationResponse = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "OpenAI-Safety-Identifier": `clinic-voice-room-procedure-text-${room.id}-${role}`
    },
    body: JSON.stringify({
      model,
      reasoning: { effort: "low" },
      text: { verbosity: "low" },
      input: [
        {
          role: "system",
          content: [{ type: "input_text", text: instructions }]
        },
        {
          role: "user",
          content: [{ type: "input_text", text: sourceText }]
        }
      ]
    })
  });

  if (!translationResponse.ok) {
    const detail = await translationResponse.text().catch(() => "");
    console.error("[procedure-turns translation]", translationResponse.status, detail);
    return NextResponse.json({ error: "Procedure turn translation failed" }, { status: 502 });
  }

  const translationData = (await translationResponse.json()) as ResponsesApiResponse;
  const translatedText = extractOutputText(translationData);
  if (!translatedText) {
    return NextResponse.json({ error: "No translated text was returned" }, { status: 502 });
  }

  const normalizedText = normalizeClinicTranslation(translatedText, targetLanguage);
  const message = {
    id: `${role}-${clientTurnId}`,
    speaker: role,
    sourceText,
    text: normalizedText,
    targetLanguage,
    createdAt: new Date().toISOString()
  };

  return NextResponse.json({ message, sourceText, translatedText: normalizedText, model });
}
