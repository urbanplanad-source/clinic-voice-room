import { normalizedTextTranslationModel } from "./openai-models";
import {
  analyzeDeterministicTranslation,
  resolveSemanticallyConfirmedDeterministic,
  type DeterministicTranslationCheck,
  type SemanticStatus,
  type TranslationValidationPath
} from "./translation-quality";
import {
  buildLocalTranslationValidationInstructions,
  parseLocalTranslationValidationResult
} from "./local-translation-validation";
import { extractResponsesOutputText } from "./openai-text-translation";
import type { TranslationQualityGuard } from "./guard-flags";

type StrictTranslation = {
  translatedText: string;
  model?: string;
  translationSource?: "verified_sentence" | "model";
};

export type MedicalSemanticValidationOutcome = {
  status: "final" | "retry_required";
  finalTranslation?: string;
  initialDeterministic: DeterministicTranslationCheck;
  finalDeterministic: DeterministicTranslationCheck;
  semanticStatus: SemanticStatus;
  corrected: boolean;
  validationPath: TranslationValidationPath;
  validationMs: number;
  correctionMs: number;
  modelAttemptCount: number;
  validationAttemptCount: number;
  correctionAttemptCount: number;
  strictAttemptCount: number;
  modelId?: string;
  translationSource: "verified_sentence" | "model";
  failureReason?: string;
};

export function translationQualityGuardFromOutcome(outcome: MedicalSemanticValidationOutcome): TranslationQualityGuard {
  return {
    initialDeterministicStatus: outcome.initialDeterministic.status,
    finalDeterministicStatus: outcome.finalDeterministic.status,
    semanticStatus: outcome.semanticStatus,
    validationPath: outcome.validationPath,
    corrected: outcome.corrected,
    riskLevel: outcome.finalDeterministic.riskLevel,
    riskReasons: outcome.finalDeterministic.riskReasons,
    failureReasons: outcome.finalDeterministic.failureReasons.length
      ? outcome.finalDeterministic.failureReasons
      : undefined,
    validationMs: outcome.validationMs,
    correctionMs: outcome.correctionMs
  };
}

const emptyDeterministic = (params: {
  sourceText: string;
  translatedText: string;
  direction: "ko_to_patient" | "patient_to_ko";
}) => analyzeDeterministicTranslation(params);

function timeoutCategory(caught: unknown) {
  const message = caught instanceof Error ? caught.message.toLowerCase() : "";
  if (message.includes("timeout") || message.includes("aborted")) return "timeout";
  return "network";
}

export async function validateMedicalTranslation(params: {
  apiKey?: string;
  sourceText: string;
  translatedText: string;
  direction: "ko_to_patient" | "patient_to_ko";
  sourceLanguage: string;
  targetLanguage: string;
  safetyIdentifier: string;
  initialTranslationSource?: "verified_sentence" | "model";
  glossaryInstructions?: string;
  semanticRequired: boolean;
  timeoutMs?: number;
  strictTranslate: () => Promise<StrictTranslation | null>;
}): Promise<MedicalSemanticValidationOutcome> {
  const initialDeterministic = emptyDeterministic(params);
  const validationStartedAt = performance.now();
  let validationAttemptCount = 0;
  let correctionAttemptCount = 0;
  let strictAttemptCount = 0;
  let modelAttemptCount = 0;
  let semanticStatus: SemanticStatus = "not_required";
  let failureReason = "";
  const confirmedSemanticRequired = params.semanticRequired ||
    initialDeterministic.status === "fail" ||
    initialDeterministic.riskLevel === "high";

  const finalize = (translatedText: string, options: {
    corrected: boolean;
    validationPath: TranslationValidationPath;
    modelId?: string;
    translationSource?: "verified_sentence" | "model";
    correctionMs?: number;
  }): MedicalSemanticValidationOutcome => {
    const rawFinalDeterministic = emptyDeterministic({ ...params, translatedText });
    const finalDeterministic = semanticStatus === "pass"
      ? resolveSemanticallyConfirmedDeterministic(rawFinalDeterministic)
      : rawFinalDeterministic;
    if (finalDeterministic.status === "fail") {
      return {
        status: "retry_required",
        initialDeterministic,
        finalDeterministic,
        semanticStatus,
        corrected: options.corrected,
        validationPath: options.validationPath,
        validationMs: Math.round(performance.now() - validationStartedAt),
        correctionMs: options.correctionMs ?? 0,
        modelAttemptCount,
        validationAttemptCount,
        correctionAttemptCount,
        strictAttemptCount,
        modelId: options.modelId,
        translationSource: options.translationSource ?? "model",
        failureReason: finalDeterministic.failureReasons.join(",") || failureReason || "deterministic_validation_failed"
      };
    }
    return {
      status: "final",
      finalTranslation: translatedText.trim(),
      initialDeterministic,
      finalDeterministic,
      semanticStatus,
      corrected: options.corrected,
      validationPath: options.validationPath,
      validationMs: Math.round(performance.now() - validationStartedAt),
      correctionMs: options.correctionMs ?? 0,
      modelAttemptCount,
      validationAttemptCount,
      correctionAttemptCount,
      strictAttemptCount,
      modelId: options.modelId,
      translationSource: options.translationSource ?? "model"
    };
  };

  const strictRepair = async () => {
    strictAttemptCount += 1;
    modelAttemptCount += 1;
    const startedAt = performance.now();
    try {
      const strict = await params.strictTranslate();
      if (!strict?.translatedText.trim()) return null;
      correctionAttemptCount += 1;
      if (confirmedSemanticRequired && strict.translationSource !== "verified_sentence") {
        failureReason = failureReason || "strict_translation_requires_semantic_confirmation";
        return null;
      }
      if (strict.translationSource === "verified_sentence") semanticStatus = "pass";
      return finalize(strict.translatedText, {
        corrected: strict.translatedText.trim() !== params.translatedText.trim(),
        validationPath: "strict",
        modelId: strict.model,
        translationSource: strict.translationSource,
        correctionMs: Math.round(performance.now() - startedAt)
      });
    } catch (caught) {
      failureReason = timeoutCategory(caught);
      return null;
    }
  };

  if (params.initialTranslationSource === "verified_sentence" && initialDeterministic.status === "pass") {
    semanticStatus = "pass";
    return finalize(params.translatedText, {
      corrected: false,
      validationPath: "standard",
      translationSource: "verified_sentence"
    });
  }

  const needsSemanticValidation = confirmedSemanticRequired;
  if (!needsSemanticValidation) {
    return finalize(params.translatedText, { corrected: false, validationPath: "standard" });
  }

  const apiKey = params.apiKey?.trim();
  if (!apiKey) {
    semanticStatus = "unavailable";
    failureReason = "configuration";
    const strict = await strictRepair();
    if (strict) return strict;
    const finalDeterministic = emptyDeterministic(params);
    return {
      status: "retry_required",
      initialDeterministic,
      finalDeterministic,
      semanticStatus,
      corrected: false,
      validationPath: "strict",
      validationMs: Math.round(performance.now() - validationStartedAt),
      correctionMs: 0,
      modelAttemptCount,
      validationAttemptCount,
      correctionAttemptCount,
      strictAttemptCount,
      translationSource: "model",
      failureReason
    };
  }

  const standardModel = normalizedTextTranslationModel(process.env.OPENAI_TEXT_TRANSLATION_MODEL);
  const model = process.env.OPENAI_TEXT_TRANSLATION_MODEL_LIGHT?.trim() || standardModel;
  const instructions = buildLocalTranslationValidationInstructions({
    sourceLanguage: params.sourceLanguage,
    targetLanguage: params.targetLanguage,
    glossaryInstructions: params.glossaryInstructions
  });
  const timeoutMs = Math.max(500, Math.min(params.timeoutMs ?? 3_200, 6_000));
  validationAttemptCount += 1;
  modelAttemptCount += 1;

  let response: Response | null = null;
  try {
    response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "OpenAI-Safety-Identifier": params.safetyIdentifier
      },
      body: JSON.stringify({
        model,
        reasoning: { effort: "low" },
        text: {
          verbosity: "low",
          format: {
            type: "json_schema",
            name: "medical_translation_validation",
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
          { role: "system", content: [{ type: "input_text", text: instructions }] },
          { role: "user", content: [{ type: "input_text", text: `Source: ${params.sourceText}\nTranslation: ${params.translatedText}` }] }
        ]
      }),
      signal: AbortSignal.timeout(timeoutMs)
    });
  } catch (caught) {
    semanticStatus = "unavailable";
    failureReason = timeoutCategory(caught);
  }

  if (!response?.ok) {
    semanticStatus = "unavailable";
    if (response) failureReason = response.status === 429 ? "rate_limited" : `provider_${response.status}`;
    const strict = await strictRepair();
    if (strict) return strict;
  } else {
    const result = parseLocalTranslationValidationResult(extractResponsesOutputText(await response.json()));
    if (!result) {
      semanticStatus = "unavailable";
      failureReason = "invalid_response";
      const strict = await strictRepair();
      if (strict) return strict;
    } else if (result.ok) {
      semanticStatus = "pass";
      return finalize(params.translatedText, { corrected: false, validationPath: "standard", modelId: model });
    } else {
      semanticStatus = result.ok ? "pass" : "fail";
      if (result.correctedTranslation.trim()) {
        correctionAttemptCount += 1;
        semanticStatus = "pass";
        const corrected = finalize(result.correctedTranslation, {
          corrected: true,
          validationPath: "repair",
          modelId: model
        });
        if (corrected.status === "final") return corrected;
      }
      const strict = await strictRepair();
      if (strict) return strict;
      failureReason = result.reason || failureReason || "semantic_validation_failed";
    }
  }

  const finalDeterministic = emptyDeterministic(params);
  return {
    status: "retry_required",
    initialDeterministic,
    finalDeterministic,
    semanticStatus,
    corrected: false,
    validationPath: "strict",
    validationMs: Math.round(performance.now() - validationStartedAt),
    correctionMs: 0,
    modelAttemptCount,
    validationAttemptCount,
    correctionAttemptCount,
    strictAttemptCount,
    modelId: model,
    translationSource: "model",
    failureReason: failureReason || "translation_validation_unresolved"
  };
}
