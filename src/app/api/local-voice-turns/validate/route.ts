import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentStaff } from "@/lib/session";
import { clientIp, rateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { buildClinicGlossaryInstructions, normalizeClinicSourceText, normalizeClinicTranslation } from "@/lib/clinic-glossary";
import { getGlossaryForHospital } from "@/lib/glossary-service";
import { isPatientLanguage, languageLabels, sourceTargetFor, type ParticipantRole, type PatientLanguage } from "@/lib/languages";
import {
  buildLocalTranslationValidationInstructions,
  hasMandatoryStaffAmountRisk,
  hasMandatoryStaffSideEffectRisk,
  parseLocalTranslationValidationResult,
  resolveLocalTranslation
} from "@/lib/local-translation-validation";
import { compareNumericSignatures, extractNumericSignature } from "@/lib/number-guard";
import { normalizedTextTranslationModel } from "@/lib/openai-models";
import { translateWithOpenAITextSafety } from "@/lib/openai-text-translation";
import { recordTranslationSample, stableTranslationSampleMessageId } from "@/lib/translation-samples";
import { matchVerifiedSentence } from "@/lib/verified-sentences";
import { isClearlyNotKoreanTranslation } from "@/lib/translation-language-guard";

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

const schema = z.object({
  patientLanguage: z.custom<PatientLanguage>((value) => isPatientLanguage(value)),
  direction: z.enum(["ko_to_patient", "patient_to_ko"]),
  sourceText: z.string().trim().min(1).max(500),
  translatedText: z.string().trim().min(1).max(500),
  force: z.boolean().optional().default(false),
  forceReason: z.string().trim().max(80).optional().default("")
});

const validationRequestBudgetMs = 6_200;
const validationModelTimeoutMs = 3_200;

function compactText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function wordCount(value: string) {
  const compact = compactText(value);
  if (!compact) return 0;
  return compact.split(" ").length;
}

function shouldCheckShortTurn(sourceText: string, translatedText: string) {
  const source = compactText(sourceText);
  const translated = compactText(translatedText);
  return source.length <= 40 || translated.length <= 70 || wordCount(source) <= 5;
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

async function recordValidatedLocalSample({
  staff,
  patientLanguage,
  direction,
  sourceText,
  canonicalSourceText,
  translatedText,
  validation
}: {
  staff: NonNullable<Awaited<ReturnType<typeof getCurrentStaff>>>;
  patientLanguage: PatientLanguage;
  direction: "ko_to_patient" | "patient_to_ko";
  sourceText: string;
  canonicalSourceText: string;
  translatedText: string;
  validation: { checked: boolean; ok: boolean; reason?: string; repaired?: boolean };
}) {
  const sourceLanguage = direction === "ko_to_patient" ? "ko" : patientLanguage;
  const targetLanguage = direction === "ko_to_patient" ? patientLanguage : "ko";

  await recordTranslationSample({
    hospitalId: staff.hospitalId,
    staffId: staff.id,
    messageId: stableTranslationSampleMessageId({
      source: "local_voice",
      mode: "local",
      direction,
      patientLanguage,
      sourceText,
      translatedText,
      sourceLanguage,
      targetLanguage
    }),
    source: "local_voice",
    mode: "local",
    direction,
    patientLanguage,
    sourceText,
    translatedText,
    sourceLanguage,
    targetLanguage,
    model: validation.repaired ? "realtime-local-repair" : "realtime-local",
    guardFlags: {
      localValidation: validation,
      sourceCanonicalization: {
        changed: canonicalSourceText !== sourceText,
        observedText: canonicalSourceText !== sourceText ? sourceText : undefined,
        canonicalText: canonicalSourceText !== sourceText ? canonicalSourceText : undefined
      }
    }
  }).catch((caught) => {
    console.error("[local-voice-turns validate sample]", caught);
  });
}

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid validation request" }, { status: 400 });
  }
  const deadlineAt = Date.now() + validationRequestBudgetMs;

  const staff = await getCurrentStaff();
  if (!staff) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limited = await rateLimit({
    key: `local-validate:${clientIp(request)}:${staff.id}:${parsed.data.patientLanguage}:${parsed.data.direction}`,
    limit: 60,
    windowMs: 60 * 1000
  });
  if (!limited.ok) {
    return rateLimitResponse(limited.retryAfter);
  }

  const { patientLanguage, direction, sourceText, translatedText } = parsed.data;
  const targetLanguageMismatch = direction === "patient_to_ko" &&
    isClearlyNotKoreanTranslation(sourceText, translatedText);
  const legacyStaffHighRisk = direction === "ko_to_patient" &&
    parsed.data.force &&
    parsed.data.forceReason === "high_risk_translation";
  const sourceStaffAmountRisk = legacyStaffHighRisk && hasMandatoryStaffAmountRisk(sourceText);
  const translatedStaffAmountRisk = legacyStaffHighRisk && hasMandatoryStaffAmountRisk(translatedText);
  const mandatoryStaffSideEffect = legacyStaffHighRisk &&
    (hasMandatoryStaffSideEffectRisk(sourceText) || hasMandatoryStaffSideEffectRisk(translatedText));
  const mandatoryStaffHighRisk =
    sourceStaffAmountRisk || translatedStaffAmountRisk || mandatoryStaffSideEffect;
  if (legacyStaffHighRisk && !mandatoryStaffHighRisk) {
    console.info("[local-voice-turns validate] legacy high-risk downgraded", JSON.stringify({
      staffId: staff.id,
      direction
    }));
    return NextResponse.json({ checked: true, ok: true, reason: "non-mandatory staff turn", validationSource: "deterministic_policy" });
  }

  const forcedCheck = parsed.data.force || targetLanguageMismatch;
  if (!forcedCheck && !shouldCheckShortTurn(sourceText, translatedText)) {
    return NextResponse.json({ checked: false, ok: true, validationSource: "not_required" });
  }
  if (forcedCheck) {
    console.info("[local-voice-turns validate] forced", JSON.stringify({
      staffId: staff.id,
      direction,
      reason: targetLanguageMismatch ? "target_language_mismatch" : parsed.data.forceReason || "client_force"
    }));
  }

  const sourceLanguage = direction === "ko_to_patient" ? "Korean" : languageLabels[patientLanguage].english;
  const targetLanguage = direction === "ko_to_patient" ? languageLabels[patientLanguage].english : "Korean";
  const targetLanguageCode = direction === "ko_to_patient" ? patientLanguage : "ko";
  const role: ParticipantRole = direction === "ko_to_patient" ? "staff" : "patient";
  const glossaryData = await getGlossaryForHospital(staff.hospitalId, staff.hospital.specialty);
  const canonicalSourceText = direction === "ko_to_patient"
    ? normalizeClinicSourceText(sourceText, glossaryData)
    : sourceText;
  const verifiedMatch = matchVerifiedSentence(canonicalSourceText, targetLanguageCode, glossaryData);
  if (verifiedMatch) {
    const verifiedTranslation = normalizeClinicTranslation(
      verifiedMatch.translatedText,
      targetLanguageCode,
      glossaryData
    );
    const normalizedCandidate = normalizeClinicTranslation(translatedText, targetLanguageCode, glossaryData);
    const repaired = compactText(verifiedTranslation) !== compactText(normalizedCandidate);
    const reason = repaired ? "verified sentence replaced candidate" : "verified sentence matched";

    await recordValidatedLocalSample({
      staff,
      patientLanguage,
      direction,
      sourceText,
      canonicalSourceText,
      translatedText: verifiedTranslation,
      validation: { checked: true, ok: !repaired, reason, repaired }
    });

    return NextResponse.json({
      checked: true,
      ok: !repaired,
      reason,
      repaired,
      correctedTranslation: repaired ? verifiedTranslation : "",
      canonicalSourceText: canonicalSourceText !== sourceText ? canonicalSourceText : "",
      validationSource: "verified_sentence",
      verifiedSentence: true
    });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    if (targetLanguageMismatch) {
      return NextResponse.json({
        checked: true,
        ok: false,
        reason: "Korean target received foreign output and repair is unavailable",
        repaired: false,
        correctedTranslation: "",
        validationSource: "unavailable",
        failureCategory: "configuration"
      });
    }
    return NextResponse.json({
      checked: false,
      ok: true,
      reason: "OPENAI_API_KEY is not configured",
      validationSource: "unavailable",
      failureCategory: "configuration"
    });
  }
  const attemptStrictRepair = async () => {
    const verifiedMatch = matchVerifiedSentence(canonicalSourceText, targetLanguageCode, glossaryData);
    if (verifiedMatch) {
      return normalizeClinicTranslation(verifiedMatch.translatedText, targetLanguageCode, glossaryData);
    }

    const directionPrompt = sourceTargetFor(role, patientLanguage);
    const repairInstructions = [
      "You are a professional medical interpreter for a Korean dermatology and plastic-surgery clinic.",
      `Source language: ${sourceLanguage}.`,
      `Target language: ${targetLanguage}.`,
      directionPrompt.instructions,
      "Preserve the speech act exactly: questions must remain questions, requests must remain requests, and statements must remain statements.",
      "Never answer the speaker, predict the other participant's reply, or continue the conversation.",
      "Preserve clinical meaning, numbers, body parts, brands, and safety instructions.",
      "Return only the faithful translated text, with no label, quote, explanation, or commentary.",
      buildClinicGlossaryInstructions(patientLanguage, glossaryData)
    ].join("\n");
    const repairTimeoutMs = deadlineAt - Date.now();
    if (repairTimeoutMs < 500) return "";

    try {
      const repaired = await translateWithOpenAITextSafety({
        apiKey,
        safetyIdentifier: `clinic-voice-room-local-repair-${staff.hospitalId}-${staff.id}-${direction}`,
        sourceText: canonicalSourceText,
        instructions: repairInstructions,
        glossaryData,
        errorLabel: "[local-voice-turns repair]",
        context: "local-voice-turns-repair",
        forceStandard: true,
        timeoutMs: repairTimeoutMs
      });
      return normalizeClinicTranslation(repaired.translatedText, targetLanguageCode, glossaryData);
    } catch (caught) {
      console.error("[local-voice-turns repair]", caught);
      return "";
    }
  };

  const recoverForcedValidation = async (failureReason: string) => {
    if (!forcedCheck) return null;

    const correctedTranslation = await attemptStrictRepair();
    const repairSucceeded = Boolean(correctedTranslation) &&
      (direction !== "patient_to_ko" || !isClearlyNotKoreanTranslation(canonicalSourceText, correctedTranslation));
    if (!repairSucceeded) {
      console.error("[local-voice-turns validate] forced recovery failed", JSON.stringify({
        staffId: staff.id,
        direction,
        forceReason: parsed.data.forceReason,
        failureReason
      }));
      return null;
    }

    const reason = `${failureReason}; strict retranslation applied`;
    await recordValidatedLocalSample({
      staff,
      patientLanguage,
      direction,
      sourceText,
      canonicalSourceText,
      translatedText: correctedTranslation,
      validation: { checked: true, ok: false, reason, repaired: true }
    });
    console.warn("[local-voice-turns validate] forced recovery applied", JSON.stringify({
      staffId: staff.id,
      direction,
      forceReason: parsed.data.forceReason,
      failureReason
    }));

    return NextResponse.json({
      checked: true,
      ok: false,
      reason,
      repaired: true,
      correctedTranslation,
      canonicalSourceText: canonicalSourceText !== sourceText ? canonicalSourceText : "",
      validationSource: "strict_repair"
    });
  };

  if (sourceStaffAmountRisk && translatedStaffAmountRisk && !mandatoryStaffSideEffect) {
    const sourceNumbers = extractNumericSignature(canonicalSourceText);
    if (sourceNumbers.length > 0) {
      const numericComparison = compareNumericSignatures(canonicalSourceText, translatedText);
      if (numericComparison.ok) {
        await recordValidatedLocalSample({
          staff,
          patientLanguage,
          direction,
          sourceText,
          canonicalSourceText,
          translatedText,
          validation: { checked: true, ok: true, reason: "mandatory amount numbers matched" }
        });
        return NextResponse.json({
          checked: true,
          ok: true,
          reason: "mandatory amount numbers matched",
          canonicalSourceText: canonicalSourceText !== sourceText ? canonicalSourceText : "",
          validationSource: "deterministic_amount"
        });
      }

      const repaired = await recoverForcedValidation("mandatory amount number mismatch");
      if (repaired) return repaired;
      return NextResponse.json({ checked: false, ok: true, reason: "mandatory amount repair unavailable", validationSource: "unavailable", failureCategory: "repair_unavailable" });
    }
  }

  if (targetLanguageMismatch) {
    const correctedTranslation = await attemptStrictRepair();
    const repairSucceeded = Boolean(correctedTranslation) &&
      !isClearlyNotKoreanTranslation(canonicalSourceText, correctedTranslation);
    const reason = repairSucceeded
      ? "Korean target received foreign output and was repaired"
      : "Korean target received foreign output and repair failed";

    if (repairSucceeded) {
      await recordValidatedLocalSample({
        staff,
        patientLanguage,
        direction,
        sourceText,
        canonicalSourceText,
        translatedText: correctedTranslation,
        validation: { checked: true, ok: false, reason, repaired: true }
      });
    }

    return NextResponse.json({
      checked: true,
      ok: false,
      reason,
      repaired: repairSucceeded,
      correctedTranslation: repairSucceeded ? correctedTranslation : "",
      canonicalSourceText: canonicalSourceText !== sourceText ? canonicalSourceText : "",
      validationSource: repairSucceeded ? "strict_repair" : "unresolved",
      failureCategory: repairSucceeded ? undefined : "repair_unavailable"
    });
  }

  const standardModel = normalizedTextTranslationModel(process.env.OPENAI_TEXT_TRANSLATION_MODEL);
  const model = process.env.OPENAI_TEXT_TRANSLATION_MODEL_LIGHT?.trim() || standardModel;
  const validationUsedLightModel = model !== standardModel;
  const instructions = buildLocalTranslationValidationInstructions({
    sourceLanguage,
    targetLanguage,
    glossaryInstructions: buildClinicGlossaryInstructions(patientLanguage, glossaryData)
  });

  const validationTimeoutMs = Math.max(
    1,
    Math.min(validationModelTimeoutMs, deadlineAt - Date.now())
  );
  let validationFailureCategory = "timeout_or_network";
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "OpenAI-Safety-Identifier": `clinic-voice-room-local-validate-${staff.hospitalId}-${staff.id}-${direction}`
    },
    body: JSON.stringify({
      model,
      reasoning: { effort: "low" },
      text: {
        verbosity: "low",
        format: {
          type: "json_schema",
          name: "local_translation_validation",
          strict: true,
          schema: {
            type: "object",
            properties: {
              ok: { type: "boolean" },
              reason: { type: "string" },
              correctedTranslation: { type: "string" }
            },
            required: ["ok", "reason", "correctedTranslation"],
            additionalProperties: false
          }
        }
      },
      input: [
        {
          role: "system",
          content: [{ type: "input_text", text: instructions }]
        },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: `Source: ${canonicalSourceText}\nTranslation: ${translatedText}`
            }
          ]
        }
      ]
    }),
    signal: AbortSignal.timeout(validationTimeoutMs)
  }).catch((caught) => {
    const message = caught instanceof Error ? caught.message.toLowerCase() : "";
    validationFailureCategory = message.includes("timeout") || message.includes("aborted")
      ? "timeout"
      : "network";
    console.error("[local-voice-turns validate] unavailable", caught);
    return null;
  });

  if (!response) {
    const recovered = await recoverForcedValidation("validation unavailable");
    if (recovered) return recovered;
    return NextResponse.json({ checked: false, ok: true, reason: "validation unavailable", validationSource: "unavailable", failureCategory: validationFailureCategory });
  }
  if (!response.ok) {
    validationFailureCategory = response.status === 429 ? "rate_limited" : "provider_http";
    const detail = await response.text().catch(() => "");
    console.error("[local-voice-turns validate]", response.status, detail);
    const recovered = await recoverForcedValidation(`validation unavailable (${response.status})`);
    if (recovered) return recovered;
    return NextResponse.json({ checked: false, ok: true, reason: "validation unavailable", validationSource: "unavailable", failureCategory: validationFailureCategory });
  }

  const data = (await response.json()) as ResponsesApiResponse;
  const result = parseLocalTranslationValidationResult(extractOutputText(data));
  if (!result) {
    const recovered = await recoverForcedValidation("validation parse skipped");
    if (recovered) return recovered;
    return NextResponse.json({ checked: false, ok: true, reason: "validation parse skipped", validationSource: "unavailable", failureCategory: "invalid_response" });
  }

  let resolved = resolveLocalTranslation(translatedText, result);
  if (!result.ok && (validationUsedLightModel || !resolved.repaired)) {
    const repairedTranslation = await attemptStrictRepair();
    resolved = repairedTranslation
      ? { translatedText: repairedTranslation, repaired: true }
      : { translatedText, repaired: false };
  } else if (resolved.repaired) {
    resolved = {
      translatedText: normalizeClinicTranslation(resolved.translatedText, targetLanguageCode, glossaryData),
      repaired: true
    };
  }

  if (result.ok || resolved.repaired) {
    await recordValidatedLocalSample({
      staff,
      patientLanguage,
      direction,
      sourceText,
      canonicalSourceText,
      translatedText: resolved.translatedText,
      validation: { checked: true, ok: result.ok, reason: result.reason, repaired: resolved.repaired }
    });
  }

  return NextResponse.json({
    checked: true,
    ok: result.ok,
    reason: result.reason,
    repaired: resolved.repaired,
    correctedTranslation: resolved.repaired ? resolved.translatedText : "",
    canonicalSourceText: canonicalSourceText !== sourceText ? canonicalSourceText : "",
    validationSource: resolved.repaired ? "strict_repair" : "model"
  });
}
