import { NextResponse } from "next/server";
import { getCurrentStaff } from "@/lib/session";
import { clientIp, rateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { buildClinicGlossaryInstructions, buildClinicTranscriptionPrompt, normalizeClinicTranslation } from "@/lib/clinic-glossary";
import { isPatientLanguage, languageLabels, sourceTargetFor, type ParticipantRole, type PatientLanguage } from "@/lib/languages";
import { recordLocalInterpreterUsageTurn } from "@/lib/local-interpreter-usage";
import { normalizedTextTranslationModel, normalizedTranscriptionModel } from "@/lib/openai-models";

type LocalDirection = "ko_to_patient" | "patient_to_ko";
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

function isTranscriptionPromptCompatibilityError(detail: string) {
  return /(?:prompt.*(?:unknown|unsupported|invalid|unrecognized)|(?:unknown|unsupported|invalid|unrecognized).*prompt)/i.test(detail);
}

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

function numberField(formData: FormData, key: string) {
  const value = Number(textField(formData, key));
  return Number.isFinite(value) ? value : 0;
}

function directionRole(direction: LocalDirection): ParticipantRole {
  return direction === "ko_to_patient" ? "staff" : "patient";
}

function transcriptionLanguageFor(direction: LocalDirection, patientLanguage: PatientLanguage) {
  if (direction === "ko_to_patient") return "ko";
  if (patientLanguage === "zh_tw" || patientLanguage === "yue") return "zh";
  return patientLanguage;
}

export async function POST(request: Request) {
  const formData = await request.formData().catch(() => null);
  if (!formData) {
    return NextResponse.json({ error: "Invalid local voice payload" }, { status: 400 });
  }

  const clientTurnId = textField(formData, "clientTurnId");
  const patientLanguage = textField(formData, "patientLanguage");
  const direction = textField(formData, "direction") as LocalDirection;
  const durationSeconds = numberField(formData, "durationSeconds");
  const audio = formData.get("audio");

  if (
    !clientTurnId ||
    clientTurnId.length > 120 ||
    !isPatientLanguage(patientLanguage) ||
    (direction !== "ko_to_patient" && direction !== "patient_to_ko") ||
    !(audio instanceof File)
  ) {
    return NextResponse.json({ error: "Invalid local voice payload" }, { status: 400 });
  }

  if (audio.size <= 0 || audio.size > 15 * 1024 * 1024) {
    return NextResponse.json({ error: "Audio turn is empty or too large" }, { status: 413 });
  }

  const staff = await getCurrentStaff();
  if (!staff) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limited = await rateLimit({
    key: `local-voice:${clientIp(request)}:${staff.id}`,
    limit: 40,
    windowMs: 60 * 1000
  });
  if (!limited.ok) {
    return rateLimitResponse(limited.retryAfter);
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "OPENAI_API_KEY is not configured" }, { status: 500 });
  }

  const role = directionRole(direction);
  const targetLanguage: TargetLanguage = direction === "ko_to_patient" ? patientLanguage : "ko";
  const sourceLanguage = direction === "ko_to_patient" ? "ko" : patientLanguage;
  const targetLabel = targetLanguage === "ko" ? "Korean" : languageLabels[patientLanguage].english;
  const sourceLabel = sourceLanguage === "ko" ? "Korean" : languageLabels[patientLanguage].english;
  const directionPrompt = sourceTargetFor(role, patientLanguage);

  const transcriptionForm = new FormData();
  transcriptionForm.set("file", audio, audio.name || `${clientTurnId}.wav`);
  transcriptionForm.set("model", normalizedTranscriptionModel(process.env.OPENAI_TRANSCRIPTION_MODEL));
  transcriptionForm.set("language", transcriptionLanguageFor(direction, patientLanguage));
  transcriptionForm.set("response_format", "json");
  transcriptionForm.set("prompt", buildClinicTranscriptionPrompt(sourceLanguage));

  let transcriptionResponse = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "OpenAI-Safety-Identifier": `clinic-voice-room-local-stt-${staff.hospitalId}-${staff.id}-${direction}`
    },
    body: transcriptionForm
  });
  let transcriptionErrorDetail = "";

  if (!transcriptionResponse.ok) {
    transcriptionErrorDetail = await transcriptionResponse.text().catch(() => "");
    if (isTranscriptionPromptCompatibilityError(transcriptionErrorDetail)) {
      transcriptionForm.delete("prompt");
      transcriptionResponse = await fetch("https://api.openai.com/v1/audio/transcriptions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "OpenAI-Safety-Identifier": `clinic-voice-room-local-stt-${staff.hospitalId}-${staff.id}-${direction}`
        },
        body: transcriptionForm
      });
      transcriptionErrorDetail = "";
    }
  }

  if (!transcriptionResponse.ok) {
    const detail = transcriptionErrorDetail || (await transcriptionResponse.text().catch(() => ""));
    console.error("[local-voice-turns transcription]", transcriptionResponse.status, detail);
    return NextResponse.json({ error: "Audio transcription failed" }, { status: 502 });
  }

  const transcriptionData = (await transcriptionResponse.json()) as TranscriptionResponse;
  const sourceText = transcriptionData.text?.trim();
  if (!sourceText) {
    return NextResponse.json({ error: "No speech was transcribed" }, { status: 422 });
  }

  const model = normalizedTextTranslationModel(process.env.OPENAI_TEXT_TRANSLATION_MODEL);
  const instructions = [
    "You are a professional medical interpreter for a Korean dermatology and plastic-surgery clinic.",
    "Translate this in-person, one-device voice turn accurately and naturally.",
    `Source language: ${sourceLabel}.`,
    `Target language: ${targetLabel}.`,
    directionPrompt.instructions,
    "Preserve clinical meaning, numbers, body parts, brands, and safety instructions.",
    "Do not add advice, diagnosis, consent language, labels, quotes, markdown, or commentary.",
    "Return only the translated text.",
    buildClinicGlossaryInstructions(patientLanguage)
  ].join("\n");

  const translationResponse = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "OpenAI-Safety-Identifier": `clinic-voice-room-local-text-${staff.hospitalId}-${staff.id}-${direction}`
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
    console.error("[local-voice-turns translation]", translationResponse.status, detail);
    return NextResponse.json({ error: "Local voice translation failed" }, { status: 502 });
  }

  const translationData = (await translationResponse.json()) as ResponsesApiResponse;
  const translatedText = extractOutputText(translationData);
  if (!translatedText) {
    return NextResponse.json({ error: "No translated text was returned" }, { status: 502 });
  }
  const normalizedTranslatedText = normalizeClinicTranslation(translatedText, targetLanguage);

  await recordLocalInterpreterUsageTurn({
    staff,
    patientLanguage,
    direction,
    transport: "upload",
    durationSeconds,
    sourceTextCharacters: sourceText.length,
    translatedTextCharacters: normalizedTranslatedText.length
  }).catch((caught) => {
    console.error("[local-voice-turns usage]", caught);
  });

  return NextResponse.json({
    sourceText,
    translatedText: normalizedTranslatedText,
    sourceLanguage,
    targetLanguage,
    direction,
    model
  });
}
