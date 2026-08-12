import { createHash, randomUUID } from "node:crypto";
import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { compareClinicalUnitSignatures } from "../../src/lib/clinical-unit-guard";
import { matchedGlossaryEntryIds } from "../../src/lib/compiled-glossary-index";
import {
  buildClinicGlossaryInstructions,
  normalizeClinicSourceText,
  normalizeClinicTranslation
} from "../../src/lib/clinic-glossary";
import { getCodeGlossaryData } from "../../src/lib/glossary-service";
import {
  patientLanguages,
  sourceTargetFor,
  translationLanguageLabels,
  type PatientLanguage,
  type TranslationLanguage
} from "../../src/lib/languages";
import {
  buildLocalTranslationValidationInstructions,
  parseLocalTranslationValidationResult
} from "../../src/lib/local-translation-validation";
import {
  compareNumericSignatures,
  hasCriticalNumericContext,
  numberGuardEnabled
} from "../../src/lib/number-guard";
import {
  analyzeDeterministicTranslation,
  resolveSemanticallyConfirmedDeterministic
} from "../../src/lib/translation-quality";
import { matchVerifiedSentence } from "../../src/lib/verified-sentences";

type UltraCase = {
  caseId: string;
  specialty: "dermatology" | "plastic_surgery" | "korean_medicine";
  synthetic: true;
  hospitalProfile: string;
  sourceLanguage: TranslationLanguage;
  targetLanguage: TranslationLanguage;
  direction: string;
  sourceText: string;
  expectedTranslation: string;
  speechAct: string;
  primaryRiskType: string;
  riskTags: string[];
  riskLevel: "normal" | "high" | "critical";
  requiredTerms: string[];
  forbiddenChanges: string[];
  expectedNumbers: string[];
  expectedBrands: string[];
  expectedQuestion: boolean;
  expectedNegation: boolean;
  audioVariants: string[];
  referenceStatus: "synthetic_unapproved";
};

type Usage = { inputTokens: number; outputTokens: number };
type ResponsePayload = {
  output_text?: string;
  output?: Array<{ content?: Array<{ text?: string }> }>;
  usage?: { input_tokens?: number; output_tokens?: number };
};

const inputUsdPerMillion = 5;
const outputUsdPerMillion = 30;
const approvedHardLimitUsd = 25;
const defaultSoftLimitUsd = 22;
const supportedCostModel = "gpt-5.5";
const phases = ["all", "ko-en", "en-ko", "ko-zh", "zh-ko", "ja", "other"] as const;

function argument(name: string, fallback?: string) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

function hasFlag(name: string) {
  return process.argv.includes(`--${name}`);
}

async function loadLocalEnv() {
  const text = await readFile(resolve(".env"), "utf8").catch(() => "");
  for (const line of text.split(/\r?\n/u)) {
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/u);
    if (!match || process.env[match[1]]) continue;
    process.env[match[1]] = match[2].trim().replace(/^['"]|['"]$/gu, "");
  }
}

function responseText(payload: ResponsePayload) {
  if (typeof payload.output_text === "string") return payload.output_text.trim();
  return payload.output
    ?.flatMap((item) => item.content ?? [])
    .map((content) => content.text)
    .filter((value): value is string => typeof value === "string")
    .join("")
    .trim() ?? "";
}

function estimateCost(usage: Usage) {
  return (usage.inputTokens * inputUsdPerMillion + usage.outputTokens * outputUsdPerMillion) / 1_000_000;
}

function finitePositiveInteger(value: string | undefined, fallback: number, maximum: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.min(maximum, Math.floor(parsed));
}

function finitePositiveNumber(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function caseFingerprint(testCase: UltraCase) {
  return createHash("sha256").update(JSON.stringify(testCase)).digest("hex").slice(0, 16);
}

function resumeKey(testCase: UltraCase, repeatIndex: number, model: string) {
  return `${testCase.caseId}#${repeatIndex}#${model}#${caseFingerprint(testCase)}`;
}

function phaseFor(testCase: UltraCase) {
  if (testCase.sourceLanguage === "ko" && testCase.targetLanguage === "en") return "ko-en";
  if (testCase.sourceLanguage === "en" && testCase.targetLanguage === "ko") return "en-ko";
  if (testCase.sourceLanguage === "ko" && ["zh", "zh_tw", "yue"].includes(testCase.targetLanguage)) return "ko-zh";
  if (["zh", "zh_tw", "yue"].includes(testCase.sourceLanguage) && testCase.targetLanguage === "ko") return "zh-ko";
  if (testCase.sourceLanguage === "ja" || testCase.targetLanguage === "ja") return "ja";
  return "other";
}

function patientLanguageFor(testCase: UltraCase): PatientLanguage {
  const value = testCase.sourceLanguage === "ko" ? testCase.targetLanguage : testCase.sourceLanguage;
  if (!patientLanguages.includes(value as PatientLanguage)) {
    throw new Error(`Unsupported patient language for ${testCase.caseId}: ${value}`);
  }
  return value as PatientLanguage;
}

function parseCases(text: string) {
  return text.split(/\r?\n/u).filter(Boolean).map((line, index) => {
    const row = JSON.parse(line) as UltraCase;
    if (!row.caseId || !row.sourceText || !row.expectedTranslation) throw new Error(`Invalid case at line ${index + 1}`);
    return row;
  });
}

async function main() {
  await loadLocalEnv();
  const model = process.env.OPENAI_TEXT_TRANSLATION_MODEL?.trim() || "gpt-5.5";
  const validationModel = process.env.OPENAI_TEXT_TRANSLATION_MODEL_LIGHT?.trim() || model;
  const evaluationModelKey = `${model}|validator=${validationModel}`;
  const inputPath = resolve(argument("input", "quality/results/ultra-translation-case-source.jsonl")!);
  const outputPath = resolve(argument("output", "quality/results/ultra-translation-live-results.jsonl")!);
  const summaryPath = resolve(argument("summary", "quality/results/ultra-translation-live-summary.json")!);
  const requestedPhase = argument("phase", "all")!;
  if (!phases.includes(requestedPhase as (typeof phases)[number])) {
    throw new Error(`Unsupported phase: ${requestedPhase}`);
  }
  const repeat = finitePositiveInteger(argument("repeat", "1"), 1, 10);
  const concurrency = finitePositiveInteger(argument("concurrency", "3"), 3, 4);
  const limit = finitePositiveInteger(argument("limit", String(Number.MAX_SAFE_INTEGER)), Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER);
  const requestedBudgetUsd = finitePositiveNumber(argument("budget", String(defaultSoftLimitUsd)), defaultSoftLimitUsd);
  const budgetLimitUsd = Math.min(requestedBudgetUsd, defaultSoftLimitUsd);
  const allCases = parseCases(await readFile(inputPath, "utf8"));
  const phaseSelected = allCases.filter((testCase) => requestedPhase === "all" || phaseFor(testCase) === requestedPhase);
  const selected = phaseSelected.slice(0, limit);
  if (hasFlag("dry-run")) {
    console.log(JSON.stringify({
      dryRun: true,
      model,
      validationModel,
      inputPath,
      requestedPhase,
      sourceCaseCount: allCases.length,
      phaseCaseCount: phaseSelected.length,
      selectedCaseCount: selected.length,
      limit: Number.isSafeInteger(limit) && limit < Number.MAX_SAFE_INTEGER ? limit : null,
      plannedCaseRunCount: selected.length * repeat,
      plannedProviderCallsMinimum: selected.length * repeat * 2,
      concurrency,
      requestedBudgetUsd,
      budgetLimitUsd,
      approvedHardLimitUsd,
      pricingSupported: model === supportedCostModel,
      validationPricingAssumption: "conservatively charged at gpt-5.5 rates"
    }, null, 2));
    return;
  }
  if (model !== supportedCostModel) {
    throw new Error(`Unsupported paid-run pricing model: ${model}. Expected ${supportedCostModel}.`);
  }
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) throw new Error("OPENAI_API_KEY is not configured");
  await mkdir(dirname(outputPath), { recursive: true });
  const existingText = await readFile(outputPath, "utf8").catch(() => "");
  const existingRows = existingText.split(/\r?\n/u).filter(Boolean).map((line) => JSON.parse(line) as Record<string, unknown>);
  const completedKeys = new Set(existingRows
    .filter((row) => row.complete !== false)
    .map((row) => typeof row.resumeKey === "string" ? row.resumeKey : "legacy_unmatched"));
  let cumulativeCostUsd = existingRows.reduce((sum, row) => sum + Number(row.estimatedCostUsd ?? 0), 0);
  let unpricedExposureUsd = existingRows.reduce((sum, row) => sum + Number(row.estimatedUnpricedExposureUsd ?? 0), 0);
  let providerCalls = existingRows.reduce((sum, row) => sum + Number(row.providerCalls ?? 0), 0);
  let reservedCostUsd = 0;
  let stopRequested = false;
  let appendChain: Promise<void> = Promise.resolve();
  const glossaryData = getCodeGlossaryData();

  const appendResult = (row: Record<string, unknown>) => {
    const next = appendChain.then(() => appendFile(outputPath, `${JSON.stringify(row)}\n`, "utf8"));
    appendChain = next.catch(() => undefined);
    return next;
  };

  const charge = (usage: Usage) => {
    const cost = estimateCost(usage);
    cumulativeCostUsd += cost;
    if (cumulativeCostUsd + unpricedExposureUsd >= budgetLimitUsd) stopRequested = true;
    return cost;
  };

  const reserveCall = (params: { instructions: string; input: string; structured?: boolean }) => {
    const maxOutputTokens = params.structured ? 1_800 : 1_600;
    const inputTokenCeiling = Buffer.byteLength(params.instructions, "utf8") + Buffer.byteLength(params.input, "utf8") + 4_096;
    const reservation = estimateCost({ inputTokens: inputTokenCeiling, outputTokens: maxOutputTokens });
    const committedExposure = cumulativeCostUsd + unpricedExposureUsd + reservedCostUsd;
    if (committedExposure + reservation > budgetLimitUsd || committedExposure + reservation > approvedHardLimitUsd) {
      stopRequested = true;
      throw new Error("budget_stop");
    }
    reservedCostUsd += reservation;
    return reservation;
  };

  const callResponses = async (params: {
    instructions: string;
    input: string;
    safetyIdentifier: string;
    reasoning: "low" | "medium";
    structured?: boolean;
    timeoutMs?: number;
    maxAttempts?: number;
    modelOverride?: string;
    onProviderAttempt?: () => void;
    onUnpricedExposure?: (amountUsd: number) => void;
  }) => {
    if (stopRequested || cumulativeCostUsd + unpricedExposureUsd >= budgetLimitUsd) throw new Error("budget_stop");
    const startedAt = performance.now();
    let lastError: unknown;
    const maxAttempts = finitePositiveInteger(String(params.maxAttempts ?? 3), 3, 3);
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      const reservation = reserveCall(params);
      let dispatched = false;
      try {
        providerCalls += 1;
        params.onProviderAttempt?.();
        dispatched = true;
        const response = await fetch("https://api.openai.com/v1/responses", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
            "OpenAI-Safety-Identifier": params.safetyIdentifier
          },
          body: JSON.stringify({
            model: params.modelOverride ?? model,
            reasoning: { effort: params.reasoning },
            max_output_tokens: params.structured ? 1_800 : 1_600,
            text: params.structured ? {
              verbosity: "low",
              format: {
                type: "json_schema",
                name: "ultra_medical_translation_validation",
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
            } : { verbosity: "low" },
            input: [
              { role: "system", content: [{ type: "input_text", text: params.instructions }] },
              { role: "user", content: [{ type: "input_text", text: params.input }] }
            ]
          }),
          signal: AbortSignal.timeout(params.timeoutMs ?? 45_000)
        });
        if (!response.ok) {
          const detail = (await response.text().catch(() => "")).slice(0, 200);
          throw new Error(`provider_${response.status}:${detail}`);
        }
        const payload = await response.json() as ResponsePayload;
        const usage = {
          inputTokens: Math.max(0, payload.usage?.input_tokens ?? 0),
          outputTokens: Math.max(0, payload.usage?.output_tokens ?? 0)
        };
        const costUsd = charge(usage);
        const text = responseText(payload);
        if (!text) throw new Error("empty_response");
        return {
          text,
          usage,
          costUsd,
          attempts: attempt,
          elapsedMs: Math.round(performance.now() - startedAt)
        };
      } catch (caught) {
        lastError = caught;
        const message = caught instanceof Error ? caught.message : String(caught);
        if (dispatched && /timeout|abort|fetch failed|network/iu.test(message)) {
          unpricedExposureUsd += reservation;
          params.onUnpricedExposure?.(reservation);
        }
        const retryable = /provider_(?:408|409|429|5\d\d)|timeout|abort/iu.test(message);
        if (!retryable || attempt === maxAttempts || stopRequested) throw caught;
        await new Promise<void>((done) => setTimeout(done, 700 * (2 ** (attempt - 1))));
      } finally {
        reservedCostUsd = Math.max(0, reservedCostUsd - reservation);
      }
    }
    throw lastError;
  };

  const runCase = async (testCase: UltraCase, repeatIndex: number) => {
    const startedAt = performance.now();
    const turnId = randomUUID();
    const patientLanguage = patientLanguageFor(testCase);
    const role = testCase.sourceLanguage === "ko" ? "staff" as const : "patient" as const;
    const direction = sourceTargetFor(role, patientLanguage);
    const qualityDirection = role === "staff" ? "ko_to_patient" as const : "patient_to_ko" as const;
    const targetLabel = translationLanguageLabels[testCase.targetLanguage].english;
    const sourceLabel = translationLanguageLabels[testCase.sourceLanguage].english;
    const canonicalSource = normalizeClinicSourceText(testCase.sourceText, glossaryData);
    const exactMatchStartedAt = performance.now();
    const verifiedMatch = matchVerifiedSentence(canonicalSource, testCase.targetLanguage, glossaryData);
    const exactMatchMs = Math.round((performance.now() - exactMatchStartedAt) * 1000) / 1000;
    const glossaryStartedAt = performance.now();
    const matchedEntryIds = matchedGlossaryEntryIds(canonicalSource, glossaryData);
    const glossaryMatchMs = Math.round((performance.now() - glossaryStartedAt) * 1000) / 1000;
    const glossaryInstructions = buildClinicGlossaryInstructions(patientLanguage, glossaryData);
    const translationInstructions = [
      "You are a professional medical interpreter for a dermatology and plastic surgery clinic.",
      "Translate the user's spoken consultation message accurately and naturally.",
      `Target language: ${targetLabel}.`,
      direction.instructions,
      "Preserve the speech act exactly: questions must remain questions, requests must remain requests, and statements must remain statements.",
      "Never answer the speaker, predict the other participant's reply, or continue the conversation.",
      "Preserve the original clinical meaning. Do not add advice, diagnosis, consent language, or extra explanation.",
      "If the source text is ambiguous, keep the translation concise and neutral rather than guessing.",
      "Return only the translated text. No labels, quotes, markdown, or commentary.",
      glossaryInstructions
    ].join("\n");
    const promptHash = createHash("sha256").update(translationInstructions).digest("hex").slice(0, 16);
    let providerCostUsd = 0;
    let caseProviderCalls = 0;
    let caseUnpricedExposureUsd = 0;
    const call = async (params: Parameters<typeof callResponses>[0]) => {
      const response = await callResponses({
        ...params,
        onProviderAttempt: () => {
          caseProviderCalls += 1;
        },
        onUnpricedExposure: (amountUsd) => {
          caseUnpricedExposureUsd += amountUsd;
        }
      });
      providerCostUsd += response.costUsd;
      return response;
    };

    try {
      let candidateTranslation = verifiedMatch?.translatedText ?? "";
      let translationMs = 0;
      let translationAttempts = 0;
      const translationSource: "verified_sentence" | "model" = verifiedMatch ? "verified_sentence" : "model";
      let numberGuardOutcome: Record<string, unknown> = {
        enabled: numberGuardEnabled(),
        triggered: false,
        status: verifiedMatch ? "verified_sentence_bypass" : "not_checked"
      };
      if (!verifiedMatch) {
        const translationDeadlineAt = Date.now() + 8_000;
        const translated = await call({
          instructions: translationInstructions,
          input: canonicalSource,
          safetyIdentifier: `medivoice-ultra-translation-${testCase.caseId}-${repeatIndex}`,
          reasoning: "medium",
          timeoutMs: 8_000,
          maxAttempts: 1
        });
        candidateTranslation = translated.text;
        translationMs = translated.elapsedMs;
        translationAttempts = translated.attempts;
        const initialNumeric = compareNumericSignatures(canonicalSource, candidateTranslation);
        const initialUnits = compareClinicalUnitSignatures(canonicalSource, candidateTranslation);
        numberGuardOutcome = {
          enabled: numberGuardEnabled(),
          triggered: numberGuardEnabled() && (!initialNumeric.ok || !initialUnits.ok),
          status: !numberGuardEnabled() || (initialNumeric.ok && initialUnits.ok) ? "pass" : "retry_required",
          initialNumeric,
          initialUnits
        };

        if (numberGuardEnabled() && (!initialNumeric.ok || !initialUnits.ok)) {
          const criticalContext = hasCriticalNumericContext(canonicalSource) ||
            hasCriticalNumericContext(candidateTranslation) ||
            initialUnits.sourceUnits.length > 0 ||
            initialUnits.translatedUnits.length > 0;
          const numericRequirement = initialNumeric.ok
            ? null
            : initialNumeric.sourceNumbers.length > 0
              ? `Preserve exactly these numeric values: ${initialNumeric.sourceNumbers.join(", ")}.`
              : "Do not introduce any numeric values; the source contains none.";
          const unitRequirement = initialUnits.ok
            ? null
            : initialUnits.sourceUnits.length > 0
              ? [
                  `Preserve these clinical unit categories exactly: ${initialUnits.sourceUnits.join(", ")}.`,
                  initialUnits.pairMismatch ? `Preserve these number-to-unit pairs exactly: ${initialUnits.sourcePairs.join(", ")}.` : "",
                  "Volume units cc and mL are equivalent, but never replace volume, mass, length, shot, ampoule, percent, or IU units with another category."
                ].filter(Boolean).join(" ")
              : "Do not introduce any clinical measurement units; the source contains none.";
          const retryInstructions = [
            translationInstructions,
            `CRITICAL: ${[numericRequirement, unitRequirement].filter(Boolean).join(" ")} Re-translate precisely.`
          ].join("\n");
          try {
            const remainingMs = translationDeadlineAt - Date.now();
            if (remainingMs < 250) throw new Error("translation_retry_deadline_exceeded");
            const retry = await call({
              instructions: retryInstructions,
              input: canonicalSource,
              safetyIdentifier: `medivoice-ultra-number-retry-${testCase.caseId}-${repeatIndex}`,
              reasoning: "medium",
              timeoutMs: remainingMs,
              maxAttempts: 1
            });
            const retryNumeric = compareNumericSignatures(canonicalSource, retry.text);
            const retryUnits = compareClinicalUnitSignatures(canonicalSource, retry.text);
            translationMs += retry.elapsedMs;
            translationAttempts += retry.attempts;
            candidateTranslation = retry.text;
            numberGuardOutcome = {
              ...numberGuardOutcome,
              criticalContext,
              status: retryNumeric.ok && retryUnits.ok ? "repaired" : criticalContext ? "critical_mismatch" : "mismatch_fail_open",
              retryNumeric,
              retryUnits
            };
            if ((!retryNumeric.ok || !retryUnits.ok) && criticalContext) {
              throw new Error("critical_translation_guard_mismatch");
            }
          } catch (caught) {
            if (criticalContext) throw caught;
            numberGuardOutcome = {
              ...numberGuardOutcome,
              criticalContext,
              status: "retry_failed_fail_open",
              retryError: caught instanceof Error ? caught.message : String(caught)
            };
          }
        }
      }

      const initialDeterministicStartedAt = performance.now();
      const productionInitialDeterministic = analyzeDeterministicTranslation({
        sourceText: canonicalSource,
        translatedText: candidateTranslation,
        direction: qualityDirection
      });
      const auditInitialDeterministic = analyzeDeterministicTranslation({
        sourceText: canonicalSource,
        translatedText: candidateTranslation,
        direction: qualityDirection,
        targetLanguage: testCase.targetLanguage
      });
      const deterministicMs = Math.round((performance.now() - initialDeterministicStartedAt) * 1000) / 1000;
      let semanticStatus: "pass" | "fail" | "unavailable" = verifiedMatch ? "pass" : "unavailable";
      let semanticReason = verifiedMatch ? "exact_verified_sentence" : "";
      let validationMs = 0;
      let validationAttempts = 0;
      let correctionCandidate = "";
      let correctionMs = 0;
      let strictCandidate = "";
      let strictMs = 0;
      let strictAttempts = 0;
      let finalTranslation = verifiedMatch?.translatedText ?? "";
      let validationPath: "standard" | "repair" | "strict" = "standard";
      let corrected = false;
      let machineStatus: "pass" | "fail" | "blocked" | "unavailable" = verifiedMatch ? "pass" : "unavailable";
      let semanticParsedOk: boolean | null = verifiedMatch ? true : null;
      let productionCorrectionPassed = false;
      const productionAiSemanticRequired = !verifiedMatch && (
        role === "patient" ||
        productionInitialDeterministic.status === "fail" ||
        productionInitialDeterministic.riskLevel === "high"
      );

      if (!verifiedMatch) {
        const validationInstructions = buildLocalTranslationValidationInstructions({
          sourceLanguage: sourceLabel,
          targetLanguage: targetLabel,
          glossaryInstructions
        });
        let parsed: ReturnType<typeof parseLocalTranslationValidationResult> = null;
        try {
          validationAttempts = 1;
          const validation = await call({
            instructions: validationInstructions,
            input: `Source: ${canonicalSource}\nTranslation: ${candidateTranslation}`,
            safetyIdentifier: `medivoice-ultra-validation-${testCase.caseId}-${repeatIndex}`,
            reasoning: "low",
            structured: true,
            modelOverride: validationModel,
            timeoutMs: 3_200,
            maxAttempts: 1
          });
          validationMs = validation.elapsedMs;
          parsed = parseLocalTranslationValidationResult(validation.text);
        } catch (caught) {
          const message = caught instanceof Error ? caught.message : String(caught);
          if (message === "budget_stop") throw caught;
          semanticReason = message;
        }
        if (!parsed) {
          semanticStatus = "unavailable";
          semanticReason = semanticReason || "invalid_validation_response";
        } else {
          semanticParsedOk = parsed.ok;
          semanticStatus = parsed.ok ? "pass" : "fail";
          semanticReason = parsed.reason;
          correctionCandidate = parsed.correctedTranslation;
        }

        if (parsed?.ok) {
          const confirmedProduction = resolveSemanticallyConfirmedDeterministic(productionInitialDeterministic);
          const confirmedAudit = resolveSemanticallyConfirmedDeterministic(auditInitialDeterministic);
          if (confirmedProduction.status === "pass") finalTranslation = candidateTranslation;
          machineStatus = confirmedAudit.status === "pass" ? "pass" : "fail";
        } else if (correctionCandidate) {
          const correctionStartedAt = performance.now();
          const productionCorrectionCheck = analyzeDeterministicTranslation({
            sourceText: canonicalSource,
            translatedText: correctionCandidate,
            direction: qualityDirection
          });
          correctionMs = Math.round((performance.now() - correctionStartedAt) * 1000) / 1000;
          if (productionCorrectionCheck.status === "pass") {
            productionCorrectionPassed = true;
            finalTranslation = correctionCandidate;
            validationPath = "repair";
            corrected = correctionCandidate.trim() !== candidateTranslation.trim();
            semanticStatus = "pass";
            const auditCorrectionCheck = analyzeDeterministicTranslation({
              sourceText: canonicalSource,
              translatedText: correctionCandidate,
              direction: qualityDirection,
              targetLanguage: testCase.targetLanguage
            });
            machineStatus = auditCorrectionCheck.status === "pass" ? "pass" : "fail";
          }
        }

        if (!finalTranslation) {
          validationPath = "strict";
          try {
            strictAttempts = 1;
            const strict = await call({
              instructions: translationInstructions,
              input: canonicalSource,
              safetyIdentifier: `medivoice-ultra-strict-${testCase.caseId}-${repeatIndex}`,
              reasoning: "medium",
              timeoutMs: 8_000,
              maxAttempts: 1
            });
            strictCandidate = strict.text;
            strictMs = strict.elapsedMs;
          } catch (caught) {
            const message = caught instanceof Error ? caught.message : String(caught);
            if (message === "budget_stop") throw caught;
            semanticReason = semanticReason || message;
          }
          machineStatus = semanticStatus === "unavailable" ? "unavailable" : "blocked";
        }
      }

      const semanticConfirmedProduction = semanticStatus === "pass"
        ? resolveSemanticallyConfirmedDeterministic(productionInitialDeterministic)
        : productionInitialDeterministic;
      const productionSimulatedFinal = verifiedMatch
        ? verifiedMatch.translatedText
        : !productionAiSemanticRequired && productionInitialDeterministic.status === "pass"
          ? candidateTranslation
          : semanticParsedOk && semanticConfirmedProduction.status === "pass"
            ? candidateTranslation
            : productionCorrectionPassed
              ? correctionCandidate
              : null;
      const productionSimulatedStatus = productionSimulatedFinal ? "final" : "retry_required";

      const normalizedFinal = finalTranslation
        ? normalizeClinicTranslation(finalTranslation, testCase.targetLanguage, glossaryData)
        : "";
      const rawFinalDeterministic = analyzeDeterministicTranslation({
        sourceText: canonicalSource,
        translatedText: normalizedFinal || candidateTranslation,
        direction: qualityDirection,
        targetLanguage: testCase.targetLanguage
      });
      const finalDeterministic = semanticStatus === "pass"
        ? resolveSemanticallyConfirmedDeterministic(rawFinalDeterministic)
        : rawFinalDeterministic;
      if (normalizedFinal && finalDeterministic.status === "fail") machineStatus = "fail";
      const elapsedMs = Math.round(performance.now() - startedAt);
      const result = {
        ...testCase,
        turnId,
        repeat: repeatIndex,
        testLayer: "live_text",
        complete: true,
        resumeKey: resumeKey(testCase, repeatIndex, evaluationModelKey),
        phase: phaseFor(testCase),
        modelId: model,
        validationModelId: validationModel,
        translationSource,
        sourceText: testCase.sourceText,
        normalizedSource: canonicalSource,
        expectedTranslation: testCase.expectedTranslation,
        sttResult: null,
        candidateTranslation,
        strictCandidate: strictCandidate || null,
        finalTranslation: normalizedFinal || null,
        screenText: null,
        ttsInput: null,
        status: machineStatus,
        machineStatus,
        errorTypes: finalDeterministic.failureReasons,
        reasonKo: semanticReason || null,
        reproductionCount: 1,
        reproductionRate: null,
        packVersion: glossaryData.metadata?.packVersion ?? "unknown",
        glossaryVersion: glossaryData.metadata?.glossaryVersion ?? "unknown",
        promptHash: null,
        translationPromptHash: promptHash,
        promptRequested: null,
        promptApplied: null,
        promptChars: null,
        matchedEntryIds,
        numberGuardOutcome,
        validationPath,
        semanticStatus,
        semanticReason: semanticReason || null,
        corrected,
        correctionCandidate: correctionCandidate || null,
        autoFixable: Boolean(correctionCandidate),
        humanReviewRequired: machineStatus !== "pass" || testCase.riskLevel !== "normal",
        productionInitialDeterministic,
        productionAiSemanticRequired,
        productionSimulatedStatus,
        productionSimulatedFinal: productionSimulatedFinal
          ? normalizeClinicTranslation(productionSimulatedFinal, testCase.targetLanguage, glossaryData)
          : null,
        auditInitialDeterministic,
        finalDeterministic,
        latency: {
          sessionPrepMs: null,
          promptGenerationMs: null,
          speechEndToTranscriptMs: null,
          transcriptWaitMs: null,
          exactMatchMs,
          glossaryMatchMs,
          translationMs,
          deterministicMs,
          semanticValidationMs: validationMs,
          correctionMs,
          strictMs,
          ttsStartMs: null,
          totalMs: elapsedMs
        },
        attempts: {
          translation: translationAttempts,
          validation: validationAttempts,
          strict: strictAttempts
        },
        providerCalls: caseProviderCalls,
        estimatedCostUsd: Number(providerCostUsd.toFixed(8)),
        estimatedUnpricedExposureUsd: Number(caseUnpricedExposureUsd.toFixed(8)),
        evaluationLimitations: [
          "text-only",
          "synthetic-unapproved reference",
          "screen and TTS not exercised",
          "production semantic validator uses the same configured model family",
          "all cases receive an additional audit semantic call; productionAiSemanticRequired records whether production would call it",
          "strict retry reuses the production consultation prompt but is not released without semantic confirmation"
        ]
      };
      await appendResult(result);
      console.log(JSON.stringify({
        caseId: testCase.caseId,
        phase: phaseFor(testCase),
        status: machineStatus,
        validationPath,
        costUsd: Number(providerCostUsd.toFixed(5)),
        cumulativeCostUsd: Number(cumulativeCostUsd.toFixed(5)),
        budgetExposureUsd: Number((cumulativeCostUsd + unpricedExposureUsd).toFixed(5)),
        totalMs: elapsedMs
      }));
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : String(caught);
      const result = {
        ...testCase,
        turnId,
        repeat: repeatIndex,
        testLayer: "live_text",
        complete: false,
        resumeKey: resumeKey(testCase, repeatIndex, evaluationModelKey),
        phase: phaseFor(testCase),
        modelId: model,
        validationModelId: validationModel,
        normalizedSource: canonicalSource,
        sttResult: null,
        candidateTranslation: null,
        finalTranslation: null,
        screenText: null,
        ttsInput: null,
        status: "unavailable",
        machineStatus: "unavailable",
        errorTypes: [],
        reasonKo: message,
        reproductionCount: 1,
        reproductionRate: null,
        packVersion: glossaryData.metadata?.packVersion ?? "unknown",
        glossaryVersion: glossaryData.metadata?.glossaryVersion ?? "unknown",
        promptHash: null,
        promptRequested: null,
        promptApplied: null,
        promptChars: null,
        matchedEntryIds,
        validationPath: "standard",
        semanticStatus: "unavailable",
        corrected: false,
        correctionCandidate: null,
        autoFixable: false,
        humanReviewRequired: true,
        latency: { exactMatchMs, glossaryMatchMs, totalMs: Math.round(performance.now() - startedAt) },
        providerCalls: caseProviderCalls,
        estimatedCostUsd: Number(providerCostUsd.toFixed(8)),
        estimatedUnpricedExposureUsd: Number(caseUnpricedExposureUsd.toFixed(8)),
        error: message
      };
      await appendResult(result);
      console.log(JSON.stringify({ caseId: testCase.caseId, status: "unavailable", error: message }));
      if (message === "budget_stop") stopRequested = true;
    }
  };

  const tasks: Array<{ testCase: UltraCase; repeatIndex: number }> = [];
  for (const testCase of selected) {
    for (let repeatIndex = 1; repeatIndex <= repeat; repeatIndex += 1) {
      if (!completedKeys.has(resumeKey(testCase, repeatIndex, evaluationModelKey))) tasks.push({ testCase, repeatIndex });
    }
  }

  let cursor = 0;
  const workers = Array.from({ length: concurrency }, async () => {
    while (!stopRequested) {
      const index = cursor;
      cursor += 1;
      if (index >= tasks.length) return;
      await runCase(tasks[index].testCase, tasks[index].repeatIndex);
    }
  });
  await Promise.all(workers);
  await appendChain;
  const finalText = await readFile(outputPath, "utf8").catch(() => "");
  const rows = finalText.split(/\r?\n/u).filter(Boolean).map((line) => JSON.parse(line) as Record<string, unknown>);
  const latestCompletedByKey = new Map<string, Record<string, unknown>>();
  for (const row of rows) {
    if (row.complete === false || typeof row.resumeKey !== "string") continue;
    latestCompletedByKey.set(row.resumeKey, row);
  }
  const selectedResumeKeys = new Set(selected.flatMap((testCase) =>
    Array.from({ length: repeat }, (_, index) => resumeKey(testCase, index + 1, evaluationModelKey))
  ));
  const selectedCompletedRows = Array.from(latestCompletedByKey.entries())
    .filter(([key]) => selectedResumeKeys.has(key))
    .map(([, row]) => row);
  const statuses = selectedCompletedRows.reduce<Record<string, number>>((counts, row) => {
    const status = String(row.status ?? "unknown");
    counts[status] = (counts[status] ?? 0) + 1;
    return counts;
  }, {});
  const summary = {
    updatedAt: new Date().toISOString(),
    model,
    validationModel,
    validationPricingAssumption: "conservatively charged at gpt-5.5 rates",
    requestedPhase,
    sourceCaseCount: allCases.length,
    phaseCaseCount: phaseSelected.length,
    selectedCaseCount: selected.length,
    limit: Number.isSafeInteger(limit) && limit < Number.MAX_SAFE_INTEGER ? limit : null,
    historicalRecordCount: rows.length,
    allCompletedResultCount: latestCompletedByKey.size,
    selectedCompletedResultCount: selectedCompletedRows.length,
    selectedRemainingResultCount: Math.max(0, selectedResumeKeys.size - selectedCompletedRows.length),
    statuses,
    providerCalls,
    estimatedCostUsd: Number(cumulativeCostUsd.toFixed(8)),
    estimatedUnpricedExposureUsd: Number(unpricedExposureUsd.toFixed(8)),
    budgetExposureUsd: Number((cumulativeCostUsd + unpricedExposureUsd).toFixed(8)),
    requestedBudgetUsd,
    budgetLimitUsd,
    approvedHardLimitUsd,
    budgetStop: stopRequested,
    outputPath
  };
  await writeFile(summaryPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
  console.log(JSON.stringify(summary, null, 2));
}

void main().catch((caught) => {
  console.error(caught instanceof Error ? caught.message : caught);
  process.exitCode = 1;
});
