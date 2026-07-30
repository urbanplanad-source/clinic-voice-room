import { NextResponse } from "next/server";
import { getCurrentStaff } from "@/lib/session";
import { clientIp, rateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { buildClinicGlossaryInstructions, buildClinicTranscriptionPrompt, normalizeClinicTranslation } from "@/lib/clinic-glossary";
import { getGlossaryForHospital } from "@/lib/glossary-service";
import { isPatientLanguage, languageLabels, sourceTargetFor, type ParticipantRole, type PatientLanguage } from "@/lib/languages";
import { recordLocalInterpreterUsageTurn } from "@/lib/local-interpreter-usage";
import type { GuardFlags } from "@/lib/guard-flags";
import { recordTranslationSample } from "@/lib/translation-samples";
import { normalizedTranscriptionModel } from "@/lib/openai-models";
import { translateWithOpenAITextSafety } from "@/lib/openai-text-translation";
import { matchVerifiedSentence } from "@/lib/verified-sentences";
import { isClearlyNotKoreanTranslation } from "@/lib/translation-language-guard";

type LocalDirection = "ko_to_patient" | "patient_to_ko";
type TargetLanguage = PatientLanguage | "ko";

type TranscriptionResponse = {
  text?: string;
};

function isTranscriptionPromptCompatibilityError(detail: string) {
  return /(?:prompt.*(?:unknown|unsupported|invalid|unrecognized)|(?:unknown|unsupported|invalid|unrecognized).*prompt)/i.test(detail);
}

function isTranscriptionLanguageCompatibilityError(detail: string) {
  return /(?:language.*(?:unknown|unsupported|invalid|unrecognized)|(?:unknown|unsupported|invalid|unrecognized).*language)/i.test(detail);
}

function shouldSendTranscriptionLanguageHint(language: string) {
  return language !== "mn";
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

  if (textField(formData, "warm") === "1") {
    const staff = await getCurrentStaff();
    if (!staff) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    await getGlossaryForHospital(staff.hospitalId, staff.hospital.specialty);
    return NextResponse.json({ ok: true });
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
  const glossaryData = await getGlossaryForHospital(staff.hospitalId, staff.hospital.specialty);

  const transcriptionForm = new FormData();
  transcriptionForm.set("file", audio, audio.name || `${clientTurnId}.wav`);
  transcriptionForm.set("model", normalizedTranscriptionModel(process.env.OPENAI_TRANSCRIPTION_MODEL));
  const transcriptionLanguage = transcriptionLanguageFor(direction, patientLanguage);
  if (shouldSendTranscriptionLanguageHint(transcriptionLanguage)) {
    transcriptionForm.set("language", transcriptionLanguage);
  }
  transcriptionForm.set("response_format", "json");
  transcriptionForm.set("prompt", buildClinicTranscriptionPrompt(sourceLanguage, glossaryData.transcriptionHints, glossaryData.transcriptionHintMappings));

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
    if (transcriptionForm.has("language") && isTranscriptionLanguageCompatibilityError(transcriptionErrorDetail)) {
      transcriptionForm.delete("language");
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
    transcriptionErrorDetail ||= await transcriptionResponse.text().catch(() => "");
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

  const instructions = [
    "You are a professional medical interpreter for a Korean dermatology and plastic-surgery clinic.",
    "Translate this in-person, one-device voice turn accurately and naturally.",
    `Source language: ${sourceLabel}.`,
    `Target language: ${targetLabel}.`,
    directionPrompt.instructions,
    "Preserve the speech act exactly: questions must remain questions, requests must remain requests, and statements must remain statements.",
    "Never answer the speaker, predict the other participant's reply, or continue the conversation.",
    "Preserve clinical meaning, numbers, body parts, brands, and safety instructions.",
    "Do not add advice, diagnosis, consent language, labels, quotes, markdown, or commentary.",
    "Return only the translated text.",
    buildClinicGlossaryInstructions(patientLanguage, glossaryData)
  ].join("\n");

  const verifiedMatch = matchVerifiedSentence(sourceText, targetLanguage, glossaryData);
  let normalizedTranslatedText: string;
  let model: string;
  let guardFlags: GuardFlags | null = null;

  if (verifiedMatch) {
    normalizedTranslatedText = normalizeClinicTranslation(verifiedMatch.translatedText, targetLanguage, glossaryData);
    model = "verified";
  } else {
    let translation;
    try {
      translation = await translateWithOpenAITextSafety({
        apiKey,
        safetyIdentifier: `clinic-voice-room-local-text-${staff.hospitalId}-${staff.id}-${direction}`,
        sourceText,
        instructions,
        glossaryData,
        errorLabel: "[local-voice-turns translation]",
        context: "local-voice-turns"
      });
    } catch (caught) {
      if (caught instanceof Error && caught.message === "empty_translation") {
        return NextResponse.json({ error: "No translated text was returned" }, { status: 502 });
      }
      return NextResponse.json({ error: "Local voice translation failed" }, { status: 502 });
    }
    normalizedTranslatedText = normalizeClinicTranslation(translation.translatedText, targetLanguage, glossaryData);
    model = translation.model;
    guardFlags = translation.guardFlags ?? null;
  }

  if (targetLanguage === "ko" && isClearlyNotKoreanTranslation(sourceText, normalizedTranslatedText)) {
    console.error(
      "[local-voice-turns translation] rejected non-Korean target",
      JSON.stringify({ staffId: staff.id, clientTurnId, direction })
    );
    return NextResponse.json({ error: "Korean translation validation failed" }, { status: 502 });
  }

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

  await recordTranslationSample({
    hospitalId: staff.hospitalId,
    staffId: staff.id,
    messageId: clientTurnId,
    source: "local_voice",
    mode: "local",
    direction,
    patientLanguage,
    sourceText,
    translatedText: normalizedTranslatedText,
    sourceLanguage,
    targetLanguage,
    model,
    guardFlags
  }).catch((caught) => {
    console.error("[local-voice-turns sample]", caught);
  });

  return NextResponse.json({
    sourceText,
    translatedText: normalizedTranslatedText,
    sourceLanguage,
    targetLanguage,
    direction,
    model,
    guardFlags
  });
}
