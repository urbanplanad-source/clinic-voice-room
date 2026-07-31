import { NextResponse } from "next/server";
import { z } from "zod";
import { runWithBoundedRetry } from "@/lib/bounded-retry";
import { buildClinicGlossaryInstructions, normalizeClinicTranslation } from "@/lib/clinic-glossary";
import { getGlossaryForHospital } from "@/lib/glossary-service";
import {
  isTranslationLanguage,
  translationLanguageLabels,
  type PatientLanguage,
  type TranslationLanguage
} from "@/lib/languages";
import {
  type OpenAIKoreanPolishTranslationResult,
  polishKoreanAndTranslateWithOpenAITextSafety
} from "@/lib/openai-korean-polish-translation";
import {
  CriticalNumericTranslationError,
  type OpenAITextTranslationResult,
  translateWithOpenAITextSafety
} from "@/lib/openai-text-translation";
import { clientIp, rateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { getCurrentStaff } from "@/lib/session";
import { matchVerifiedSentence } from "@/lib/verified-sentences";
import { recordTextTranslationUsage } from "@/lib/text-translation-usage";

export const maxDuration = 45;

const staffTranslationAttemptTimeoutMs = 12_000;
const staffTranslationMaxAttempts = 2;

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
  glossaryData,
  orderedKoreanOutput
}: {
  sourceLanguage: TranslationLanguage;
  targetLanguage: TranslationLanguage;
  glossaryData: Awaited<ReturnType<typeof getGlossaryForHospital>>;
  orderedKoreanOutput: boolean;
}) {
  const sourceLabel = translationLanguageLabels[sourceLanguage].english;
  const targetLabel = translationLanguageLabels[targetLanguage].english;

  return [
    "You are a professional medical interpreter for a Korean hospital consultation desk.",
    `Translate from ${sourceLabel} to ${targetLabel}.`,
    ...(orderedKoreanOutput
      ? [
          "Perform these steps exactly in order:",
          "1. Rewrite the Korean staff message into clear, readable, natural, polite Korean in polishedKorean. Correct spacing, grammar, honorifics, and colloquial endings without changing meaning.",
          "2. Translate the complete polishedKorean from step 1 into the target language in translatedText. Do not translate directly from the raw input.",
          "polishedKorean must be the exact Korean sentence used as the basis for translatedText."
        ]
      : []),
    "The likely context is dermatology, plastic surgery, reception, pricing, consent, procedure guidance, side effects, aftercare, or patient questions.",
    "Use natural, polite wording suitable for live hospital counseling.",
    "Preserve the original clinical meaning. Do not add advice, diagnosis, consent language, risk claims, or extra explanation.",
    "Keep numbers, units, dates, procedure names, medication names, and body areas exact.",
    "Preserve line breaks when they help readability.",
    orderedKoreanOutput
      ? "Return only the required polishedKorean and translatedText structured fields."
      : "Return only the translated text. No labels, quotes, markdown, or commentary.",
    glossaryInstructionsFor(targetLanguage, glossaryData)
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
  const directVerifiedMatch =
    parsed.data.sourceLanguage === "ko"
      ? matchVerifiedSentence(parsed.data.text, parsed.data.targetLanguage, glossaryData)
      : null;

  if (directVerifiedMatch) {
    const translatedText = normalizeClinicTranslation(
      directVerifiedMatch.translatedText,
      parsed.data.targetLanguage,
      glossaryData
    );
    await recordTextTranslationUsage({
      staff,
      sourceLanguage: parsed.data.sourceLanguage,
      targetLanguage: parsed.data.targetLanguage
    }).catch((caught) => {
      console.error("[staff-text-translate usage]", caught);
    });

    return NextResponse.json({
      translatedText,
      polishedSourceText: directVerifiedMatch.entry.standardKo,
      sourceLanguage: parsed.data.sourceLanguage,
      targetLanguage: parsed.data.targetLanguage,
      model: "verified",
      polishModel: null
    });
  }

  const fallbackPolishedSourceText =
    parsed.data.sourceLanguage === "ko" && parsed.data.targetLanguage !== "ko"
      ? fallbackKoreanPolish(parsed.data.text)
      : undefined;

  const verifiedMatch =
    parsed.data.sourceLanguage === "ko"
      ? matchVerifiedSentence(fallbackPolishedSourceText ?? parsed.data.text, parsed.data.targetLanguage, glossaryData) ??
        matchVerifiedSentence(parsed.data.text, parsed.data.targetLanguage, glossaryData)
      : null;

  if (verifiedMatch) {
    const translatedText = normalizeClinicTranslation(verifiedMatch.translatedText, parsed.data.targetLanguage, glossaryData);
    await recordTextTranslationUsage({
      staff,
      sourceLanguage: parsed.data.sourceLanguage,
      targetLanguage: parsed.data.targetLanguage
    }).catch((caught) => {
      console.error("[staff-text-translate usage]", caught);
    });

    return NextResponse.json({
      translatedText,
      polishedSourceText: verifiedMatch.entry.standardKo,
      sourceLanguage: parsed.data.sourceLanguage,
      targetLanguage: parsed.data.targetLanguage,
      model: "verified",
      polishModel: null
    });
  }

  const orderedKoreanOutput = parsed.data.sourceLanguage === "ko" && parsed.data.targetLanguage !== "ko";
  const instructions = buildInstructions({
    sourceLanguage: parsed.data.sourceLanguage,
    targetLanguage: parsed.data.targetLanguage,
    glossaryData,
    orderedKoreanOutput
  });

  let translation: OpenAITextTranslationResult | OpenAIKoreanPolishTranslationResult;
  try {
    translation = await runWithBoundedRetry({
      maxAttempts: staffTranslationMaxAttempts,
      retryDelayMs: 150,
      operation: () => orderedKoreanOutput
        ? polishKoreanAndTranslateWithOpenAITextSafety({
            apiKey,
            safetyIdentifier: `clinic-voice-room-staff-text-${staff.id}-${patientLanguageForUsage(parsed.data.sourceLanguage, parsed.data.targetLanguage)}`,
            sourceText: parsed.data.text,
            instructions,
            glossaryData,
            errorLabel: "[staff-text-translate-ordered]",
            context: "staff-text-translate-ordered",
            forceStandard: true,
            timeoutMs: staffTranslationAttemptTimeoutMs
          })
        : translateWithOpenAITextSafety({
            apiKey,
            safetyIdentifier: `clinic-voice-room-staff-text-${staff.id}-${patientLanguageForUsage(parsed.data.sourceLanguage, parsed.data.targetLanguage)}`,
            sourceText: parsed.data.text,
            instructions,
            glossaryData,
            errorLabel: "[staff-text-translate]",
            context: "staff-text-translate",
            forceStandard: true,
            timeoutMs: staffTranslationAttemptTimeoutMs
          }),
      onFailure: (failure) => {
        console.error("[staff-text-translate] attempt failed", JSON.stringify(failure));
      },
      shouldRetry: (caught) => !(
        caught instanceof CriticalNumericTranslationError &&
        caught.message === "critical_translation_guard_mismatch"
      )
    });
  } catch (caught) {
    if (caught instanceof Error && caught.message === "empty_translation") {
      return NextResponse.json({ error: "No translated text was returned" }, { status: 502 });
    }
    return NextResponse.json(
      { error: "일시적으로 번역하지 못했습니다. 잠시 후 다시 시도해주세요." },
      { status: 502 }
    );
  }

  const translatedText = normalizeClinicTranslation(translation.translatedText, parsed.data.targetLanguage, glossaryData);
  const polishedSourceText =
    orderedKoreanOutput && "polishedSourceText" in translation
      ? translation.polishedSourceText
      : null;
  await recordTextTranslationUsage({
    staff,
    sourceLanguage: parsed.data.sourceLanguage,
    targetLanguage: parsed.data.targetLanguage
  }).catch((caught) => {
    console.error("[staff-text-translate usage]", caught);
  });

  return NextResponse.json({
    translatedText,
    polishedSourceText,
    sourceLanguage: parsed.data.sourceLanguage,
    targetLanguage: parsed.data.targetLanguage,
    model: translation.model,
    polishModel: orderedKoreanOutput ? translation.model : null,
    guardFlags: translation.guardFlags ?? null
  });
}
