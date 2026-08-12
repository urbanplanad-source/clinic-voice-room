import { readFile, mkdir, writeFile, appendFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { randomUUID } from "node:crypto";
import { getCodeGlossaryData } from "../src/lib/glossary-service";
import { buildClinicGlossaryInstructions } from "../src/lib/clinic-glossary";
import { languageLabels, patientLanguages, sourceTargetFor, type PatientLanguage } from "../src/lib/languages";
import { analyzeDeterministicTranslation } from "../src/lib/translation-quality";
import { buildLocalTranslationValidationInstructions, parseLocalTranslationValidationResult } from "../src/lib/local-translation-validation";
import { extractResponsesOutputText } from "../src/lib/openai-text-translation";
import {
  estimateTextModelCostUsd,
  parseLiveEvaluationSourceJsonl,
  selectStratifiedLiveCases,
  summarizeLiveEvaluation,
  type LiveEvaluationResult
} from "../src/lib/live-translation-evaluation";

type Usage = { inputTokens: number; outputTokens: number };
type ResponsePayload = { output_text?: string; output?: Array<{ content?: Array<{ text?: string }> }>; usage?: { input_tokens?: number; output_tokens?: number } };

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

async function callResponses(params: {
  apiKey: string;
  model: string;
  instructions: string;
  input: string;
  safetyIdentifier: string;
  structured?: boolean;
}) {
  const startedAt = performance.now();
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${params.apiKey}`,
      "Content-Type": "application/json",
      "OpenAI-Safety-Identifier": params.safetyIdentifier
    },
    body: JSON.stringify({
      model: params.model,
      reasoning: { effort: params.structured ? "low" : "medium" },
      text: params.structured ? {
        verbosity: "low",
        format: {
          type: "json_schema",
          name: "live_medical_translation_evaluation",
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
    signal: AbortSignal.timeout(30_000)
  });
  if (!response.ok) throw new Error(`provider_${response.status}:${(await response.text().catch(() => "")).slice(0, 200)}`);
  const payload = await response.json() as ResponsePayload;
  const usage: Usage = {
    inputTokens: Math.max(0, payload.usage?.input_tokens ?? 0),
    outputTokens: Math.max(0, payload.usage?.output_tokens ?? 0)
  };
  return { text: extractResponsesOutputText(payload), usage, elapsedMs: Math.round(performance.now() - startedAt) };
}

async function callResponsesWithRetry(params: Parameters<typeof callResponses>[0]) {
  let lastError: unknown;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      return { ...(await callResponses(params)), attempts: attempt };
    } catch (caught) {
      lastError = caught;
      const message = caught instanceof Error ? `${caught.name}:${caught.message}` : String(caught);
      const retryable = /provider_(?:408|409|429|5\d\d)|timeout|abort/iu.test(message);
      if (!retryable || attempt === 3) throw caught;
      await new Promise<void>((done) => setTimeout(done, 500 * (2 ** (attempt - 1))));
    }
  }
  throw lastError;
}

async function main() {
await loadLocalEnv();
const inputPath = resolve(argument("input", "quality/golden/private/medical-source-cases.jsonl")!);
const outputDir = resolve(argument("output-dir", `quality/results/live-${new Date().toISOString().replace(/[:.]/gu, "-")}`)!);
const requestedLanguages = argument("languages", "en,ja,zh")!.split(",").map((value) => value.trim()).filter(Boolean);
const languages = requestedLanguages.filter((value): value is PatientLanguage => patientLanguages.includes(value as PatientLanguage));
if (languages.length !== requestedLanguages.length) throw new Error(`Unsupported language in: ${requestedLanguages.join(",")}`);
const perSpecialty = Math.max(1, Number(argument("per-specialty", "1")));
const repeatCount = Math.max(1, Number(argument("repeat", "1")));
const model = process.env.OPENAI_TEXT_TRANSLATION_MODEL?.trim() || "gpt-5.5";
const priceInput = Number(process.env.LIVE_EVAL_INPUT_USD_PER_MILLION ?? (model === "gpt-5.5" ? 5 : 0));
const priceOutput = Number(process.env.LIVE_EVAL_OUTPUT_USD_PER_MILLION ?? (model === "gpt-5.5" ? 30 : 0));
const parsed = parseLiveEvaluationSourceJsonl(await readFile(inputPath, "utf8"));
if (parsed.errors.length) throw new Error(parsed.errors.join("\n"));
const requestedCaseIds = new Set(argument("case-ids", "")!.split(",").map((value) => value.trim()).filter(Boolean));
const selected = requestedCaseIds.size > 0
  ? parsed.rows.filter((row) => requestedCaseIds.has(row.id))
  : selectStratifiedLiveCases(parsed.rows, perSpecialty);
if (requestedCaseIds.size > 0 && selected.length !== requestedCaseIds.size) {
  const found = new Set(selected.map((row) => row.id));
  throw new Error("Unknown case IDs: " + Array.from(requestedCaseIds).filter((id) => !found.has(id)).join(","));
}
const plannedCalls = selected.length * languages.length * repeatCount;
const manifest = {
  createdAt: new Date().toISOString(), inputPath, outputDir, model, languages, perSpecialty, repeatCount,
  selectedCaseIds: selected.map((row) => row.id), plannedTranslationCalls: plannedCalls, plannedValidationCalls: plannedCalls,
  promptProfile: "consultation_voice_v0.3.39", glossaryVersion: getCodeGlossaryData().metadata?.glossaryVersion ?? "legacy",
  pricing: { inputUsdPerMillion: priceInput, outputUsdPerMillion: priceOutput, source: model === "gpt-5.5" ? "https://developers.openai.com/api/docs/models/gpt-5.5" : "operator_required" },
  limitations: ["text-only", "self-judge model", "no approved foreign-language reference", "not a release holdout"]
};
await mkdir(outputDir, { recursive: true });
await writeFile(join(outputDir, "manifest.json"), JSON.stringify(manifest, null, 2), "utf8");
if (hasFlag("dry-run")) {
  console.log(JSON.stringify({ dryRun: true, ...manifest }, null, 2));
  process.exit(0);
}

const apiKey = process.env.OPENAI_API_KEY?.trim();
if (!apiKey) throw new Error("OPENAI_API_KEY is not configured");
const runId = randomUUID();
const resultPath = join(outputDir, "results.jsonl");
await writeFile(resultPath, "", "utf8");
const results: LiveEvaluationResult[] = [];
const glossaryData = getCodeGlossaryData();

for (const sourceCase of selected) {
  for (const targetLanguage of languages) {
    for (let repeat = 1; repeat <= repeatCount; repeat += 1) {
      const totalStartedAt = performance.now();
      const riskTags = [sourceCase.primaryRiskType, ...sourceCase.riskFlags.split(/[;,]/u)].map((value) => value.trim()).filter(Boolean);
      let result: LiveEvaluationResult;
      try {
        const targetLabel = languageLabels[targetLanguage].english;
        const instructions = [
          "You are a professional medical interpreter for a dermatology and plastic surgery clinic.",
          "Translate the user's spoken consultation message accurately and naturally.",
          `Target language: ${targetLabel}.`,
          sourceTargetFor("staff", targetLanguage).instructions,
          "Preserve the speech act exactly: questions must remain questions, requests must remain requests, and statements must remain statements.",
          "Never answer the speaker, predict the other participant's reply, or continue the conversation.",
          "Preserve the original clinical meaning. Do not add advice, diagnosis, consent language, or extra explanation.",
          "If the source text is ambiguous, keep the translation concise and neutral rather than guessing.",
          "Return only the translated text. No labels, quotes, markdown, or commentary.",
          buildClinicGlossaryInstructions(targetLanguage, glossaryData)
        ].join("\n");
        const translation = await callResponsesWithRetry({
          apiKey, model, instructions, input: sourceCase.standardKo,
          safetyIdentifier: `medivoice-live-eval-translation-${sourceCase.id}-${targetLanguage}-${repeat}`
        });
        const deterministic = analyzeDeterministicTranslation({
          sourceText: sourceCase.standardKo,
          translatedText: translation.text,
          direction: "ko_to_patient",
          targetLanguage
        });
        const validationInstructions = [
          buildLocalTranslationValidationInstructions({
            sourceLanguage: "Korean",
            targetLanguage: targetLabel,
            glossaryInstructions: buildClinicGlossaryInstructions(targetLanguage, glossaryData)
          }),
          `Required meaning or terms: ${sourceCase.requiredTerms || "none specified"}.`,
          `Forbidden changes: ${sourceCase.forbiddenChanges || "none specified"}.`
        ].join("\n");
        const validation = await callResponsesWithRetry({
          apiKey, model, instructions: validationInstructions,
          input: `Source: ${sourceCase.standardKo}\nTranslation: ${translation.text}`,
          safetyIdentifier: `medivoice-live-eval-validation-${sourceCase.id}-${targetLanguage}-${repeat}`,
          structured: true
        });
        const semantic = parseLocalTranslationValidationResult(validation.text);
        const semanticStatus = semantic ? (semantic.ok ? "pass" as const : "fail" as const) : "unavailable" as const;
        const status = deterministic.status === "fail" || semanticStatus === "fail" ? "fail" as const : semanticStatus === "unavailable" ? "review" as const : "pass" as const;
        const inputTokens = translation.usage.inputTokens + validation.usage.inputTokens;
        const outputTokens = translation.usage.outputTokens + validation.usage.outputTokens;
        result = {
          runId, caseId: sourceCase.id, semanticGroupId: sourceCase.semanticGroupId, specialty: sourceCase.specialty,
          targetLanguage, repeat, sourceText: sourceCase.standardKo, candidateTranslation: translation.text,
          correctedTranslation: semantic?.correctedTranslation || undefined, model, status,
          deterministicStatus: deterministic.status, deterministicFailureReasons: deterministic.failureReasons,
          semanticStatus, semanticReason: semantic?.reason, translationMs: translation.elapsedMs,
          validationMs: validation.elapsedMs, totalMs: Math.round(performance.now() - totalStartedAt),
          translationAttempts: translation.attempts, validationAttempts: validation.attempts,
          inputTokens, outputTokens,
          estimatedCostUsd: estimateTextModelCostUsd({ inputTokens, outputTokens, inputUsdPerMillion: priceInput, outputUsdPerMillion: priceOutput }),
          riskLevel: sourceCase.riskLevel, riskTags, requiredTerms: sourceCase.requiredTerms,
          forbiddenChanges: sourceCase.forbiddenChanges, sourceQaStatus: sourceCase.sourceQaStatus
        };
      } catch (caught) {
        result = {
          runId, caseId: sourceCase.id, semanticGroupId: sourceCase.semanticGroupId, specialty: sourceCase.specialty,
          targetLanguage, repeat, sourceText: sourceCase.standardKo, model, status: "error", deterministicStatus: "fail",
          deterministicFailureReasons: [], semanticStatus: "unavailable", translationMs: 0, validationMs: 0,
          totalMs: Math.round(performance.now() - totalStartedAt), inputTokens: 0, outputTokens: 0, estimatedCostUsd: 0,
          riskLevel: sourceCase.riskLevel, riskTags, requiredTerms: sourceCase.requiredTerms,
          forbiddenChanges: sourceCase.forbiddenChanges, sourceQaStatus: sourceCase.sourceQaStatus,
          error: caught instanceof Error ? caught.message : "unknown_error"
        };
      }
      results.push(result);
      await appendFile(resultPath, `${JSON.stringify(result)}\n`, "utf8");
      console.log(JSON.stringify({ caseId: result.caseId, language: result.targetLanguage, status: result.status, totalMs: result.totalMs }));
    }
  }
}

const summary = { runId, completedAt: new Date().toISOString(), manifest, ...summarizeLiveEvaluation(results) };
await writeFile(join(outputDir, "summary.json"), JSON.stringify(summary, null, 2), "utf8");
console.log(JSON.stringify(summary, null, 2));
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});

