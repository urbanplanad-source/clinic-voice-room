import { NextResponse } from "next/server";
import { z } from "zod";
import { buildClinicGlossaryInstructions, normalizeClinicTranslation } from "@/lib/clinic-glossary";
import { getGlossaryForHospital } from "@/lib/glossary-service";
import {
  isTranslationLanguage,
  translationLanguageLabels,
  type PatientLanguage,
  type TranslationLanguage
} from "@/lib/languages";
import { translateWithOpenAITextSafety } from "@/lib/openai-text-translation";
import { clientIp, rateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { getCurrentStaff } from "@/lib/session";
import { matchVerifiedSentence } from "@/lib/verified-sentences";

const schema = z.object({
  sourceLanguage: z.custom<TranslationLanguage>((value) => isTranslationLanguage(value)),
  targetLanguage: z.custom<TranslationLanguage>((value) => isTranslationLanguage(value)),
  text: z.string().trim().min(1).max(3000)
}).refine((value) => value.sourceLanguage !== value.targetLanguage, {
  message: "Source and target languages must be different.",
  path: ["targetLanguage"]
});

function glossaryInstructionsFor(targetLanguage: TranslationLanguage, glossaryData: Awaited<ReturnType<typeof getGlossaryForHospital>>) {
  if (targetLanguage !== "ko") {
    return buildClinicGlossaryInstructions(targetLanguage, glossaryData);
  }

  return [
    "Clinic glossary rules:",
    "- Preserve clinic brand and procedure names accurately.",
    "- Translate the patient's message into natural Korean that hospital staff can use immediately.",
    "- Keep counts, units, body areas, prices, risks, aftercare timing, and medication details exact.",
    "- Do not expand brand names into generic explanations unless the source text explains them."
  ].join("\n");
}

function buildInstructions({
  sourceLanguage,
  targetLanguage,
  glossaryData
}: {
  sourceLanguage: TranslationLanguage;
  targetLanguage: TranslationLanguage;
  glossaryData: Awaited<ReturnType<typeof getGlossaryForHospital>>;
}) {
  const sourceLabel = translationLanguageLabels[sourceLanguage].english;
  const targetLabel = translationLanguageLabels[targetLanguage].english;

  return [
    "You are a professional medical interpreter for a Korean hospital consultation desk.",
    `Translate from ${sourceLabel} to ${targetLabel}.`,
    "The likely context is dermatology, plastic surgery, reception, pricing, consent, procedure guidance, side effects, aftercare, or patient questions.",
    "Use natural, polite wording suitable for live hospital counseling.",
    "Preserve the original clinical meaning. Do not add advice, diagnosis, consent language, risk claims, or extra explanation.",
    "Keep numbers, units, dates, procedure names, medication names, and body areas exact.",
    "Preserve line breaks when they help readability.",
    "Return only the translated text. No labels, quotes, markdown, or commentary.",
    glossaryInstructionsFor(targetLanguage, glossaryData)
  ].join("\n");
}

function buildKoreanPolishInstructions() {
  return [
    "You are a Korean medical consultation editor for a hospital translation desk.",
    "Rewrite the Korean staff message into clear, readable, polite Korean before it is translated for a foreign patient.",
    "Preserve the original clinical meaning exactly. Do not add diagnosis, advice, consent language, risk claims, discounts, or explanations.",
    "Keep all numbers, prices, units, dates, treatment names, medication names, and body areas exact.",
    "Use natural hospital counseling wording in Korean honorific style.",
    "If the input is already clear, make only minimal spacing, punctuation, and readability edits.",
    "Return only the polished Korean text. No labels, quotes, markdown, or commentary."
  ].join("\n");
}

function fallbackKoreanPolish(text: string) {
  let polished = text
    .normalize("NFKC")
    .replace(/\s+/g, " ")
    .replace(/\s+([,.?!。？！])/g, "$1")
    .trim();

  polished = polished.replace(/(\d+)\s*샷에\s*([0-9,]+)\s*만원/g, "$1샷 기준 $2만원");
  polished = polished.replace(/([가-힣])해주세요/g, "$1해 주세요");

  if (polished && !/[.!?。？！]$/.test(polished)) {
    polished += ".";
  }

  return polished;
}

function patientLanguageForUsage(sourceLanguage: TranslationLanguage, targetLanguage: TranslationLanguage): PatientLanguage {
  if (targetLanguage !== "ko") return targetLanguage;
  if (sourceLanguage !== "ko") return sourceLanguage;
  return "en";
}

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid translation request" }, { status: 400 });
  }

  const staff = await getCurrentStaff();
  if (!staff) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limited = await rateLimit({
    key: `staff-text-translate:${clientIp(request)}:${staff.id}`,
    limit: 50,
    windowMs: 60 * 1000
  });
  if (!limited.ok) {
    return rateLimitResponse(limited.retryAfter);
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "OPENAI_API_KEY is not configured" }, { status: 500 });
  }

  const glossaryData = await getGlossaryForHospital(staff.hospitalId, staff.hospital.specialty);
  let sourceTextForTranslation = parsed.data.text;
  let polishedSourceText: string | undefined;
  let polishModel: string | undefined;

  if (parsed.data.sourceLanguage === "ko" && parsed.data.targetLanguage !== "ko") {
    const fallbackPolishedText = fallbackKoreanPolish(parsed.data.text);
    try {
      const polish = await translateWithOpenAITextSafety({
        apiKey,
        safetyIdentifier: `clinic-voice-room-staff-text-polish-${staff.id}`,
        sourceText: parsed.data.text,
        instructions: buildKoreanPolishInstructions(),
        glossaryData,
        errorLabel: "[staff-text-polish]",
        context: "staff-text-polish",
        forceStandard: true
      });
      const normalizedPolishedText = normalizeClinicTranslation(polish.translatedText, "ko", glossaryData);
      polishedSourceText = normalizedPolishedText || fallbackPolishedText;
      polishModel = polish.model;
    } catch (caught) {
      console.error("[staff-text-polish] fail-open", caught);
      polishedSourceText = fallbackPolishedText;
      polishModel = "fallback";
    }
    sourceTextForTranslation = polishedSourceText;
  }

  const verifiedMatch =
    parsed.data.sourceLanguage === "ko"
      ? matchVerifiedSentence(sourceTextForTranslation, parsed.data.targetLanguage, glossaryData) ??
        matchVerifiedSentence(parsed.data.text, parsed.data.targetLanguage, glossaryData)
      : null;

  if (verifiedMatch) {
    const translatedText = normalizeClinicTranslation(verifiedMatch.translatedText, parsed.data.targetLanguage, glossaryData);
    return NextResponse.json({
      translatedText,
      polishedSourceText: polishedSourceText ?? (parsed.data.sourceLanguage === "ko" ? verifiedMatch.entry.standardKo : undefined),
      sourceLanguage: parsed.data.sourceLanguage,
      targetLanguage: parsed.data.targetLanguage,
      model: "verified",
      polishModel: polishModel ?? null
    });
  }

  const instructions = buildInstructions({
    sourceLanguage: parsed.data.sourceLanguage,
    targetLanguage: parsed.data.targetLanguage,
    glossaryData
  });

  let translation;
  try {
    translation = await translateWithOpenAITextSafety({
      apiKey,
      safetyIdentifier: `clinic-voice-room-staff-text-${staff.id}-${patientLanguageForUsage(parsed.data.sourceLanguage, parsed.data.targetLanguage)}`,
      sourceText: sourceTextForTranslation,
      instructions,
      glossaryData,
      errorLabel: "[staff-text-translate]",
      context: "staff-text-translate",
      forceStandard: true
    });
  } catch (caught) {
    if (caught instanceof Error && caught.message === "empty_translation") {
      return NextResponse.json({ error: "No translated text was returned" }, { status: 502 });
    }
    return NextResponse.json({ error: "Text translation failed" }, { status: 502 });
  }

  const translatedText = normalizeClinicTranslation(translation.translatedText, parsed.data.targetLanguage, glossaryData);
  return NextResponse.json({
    translatedText,
    polishedSourceText: polishedSourceText ?? null,
    sourceLanguage: parsed.data.sourceLanguage,
    targetLanguage: parsed.data.targetLanguage,
    model: translation.model,
    polishModel: polishModel ?? null,
    guardFlags: translation.guardFlags ?? null
  });
}
