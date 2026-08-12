import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { extractResponsesOutputText } from "../src/lib/openai-text-translation";

type SourceResult = {
  runId: string;
  caseId: string;
  specialty: string;
  targetLanguage: string;
  sourceText: string;
  candidateTranslation: string;
  status: "pass" | "review" | "fail" | "error";
  deterministicFailureReasons: string[];
  semanticStatus: string;
  semanticReason?: string;
  requiredTerms: string;
  forbiddenChanges: string;
  riskLevel: string;
  riskTags: string[];
};

type Adjudication = {
  verdict: "pass" | "review" | "fail";
  deterministicRuleVerdict: "true_error" | "false_positive" | "mixed" | "not_applicable";
  medicalSeverity: "none" | "minor" | "major" | "critical";
  errorTypes: string[];
  reasonKo: string;
  correctedTranslation: string;
};

type ResponsePayload = {
  output_text?: string;
  output?: Array<{ content?: Array<{ text?: string }> }>;
  usage?: { input_tokens?: number; output_tokens?: number };
};

function argument(name: string, fallback: string) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

async function loadLocalEnv() {
  const text = await readFile(resolve(".env"), "utf8").catch(() => "");
  for (const line of text.split(/\r?\n/u)) {
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/u);
    if (!match || process.env[match[1]]) continue;
    process.env[match[1]] = match[2].trim().replace(/^['"]|['"]$/gu, "");
  }
}

function parseJsonl<T>(text: string) {
  return text.split(/\r?\n/u).filter(Boolean).map((line) => JSON.parse(line) as T);
}

async function callAdjudicator(params: {
  apiKey: string;
  model: string;
  row: SourceResult;
}) {
  const startedAt = performance.now();
  let lastError: unknown;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${params.apiKey}`,
          "Content-Type": "application/json",
          "OpenAI-Safety-Identifier": `medivoice-adjudication-${params.row.caseId}-${params.row.targetLanguage}`
        },
        body: JSON.stringify({
          model: params.model,
          reasoning: { effort: "high" },
          text: {
            verbosity: "low",
            format: {
              type: "json_schema",
              name: "medical_translation_adjudication",
              strict: true,
              schema: {
                type: "object",
                properties: {
                  verdict: { type: "string", enum: ["pass", "review", "fail"] },
                  deterministicRuleVerdict: { type: "string", enum: ["true_error", "false_positive", "mixed", "not_applicable"] },
                  medicalSeverity: { type: "string", enum: ["none", "minor", "major", "critical"] },
                  errorTypes: {
                    type: "array",
                    items: {
                      type: "string",
                      enum: [
                        "meaning_omission", "meaning_addition", "medical_term_error", "language_mixing",
                        "number_or_unit", "question_or_speech_act", "negation_or_prohibition", "direction_or_body_side",
                        "register_or_force", "brand_error", "deterministic_false_positive", "other"
                      ]
                    }
                  },
                  reasonKo: { type: "string" },
                  correctedTranslation: { type: "string" }
                },
                required: ["verdict", "deterministicRuleVerdict", "medicalSeverity", "errorTypes", "reasonKo", "correctedTranslation"],
                additionalProperties: false
              }
            }
          },
          input: [
            {
              role: "system",
              content: [{
                type: "input_text",
                text: [
                  "You are the senior adjudicator for a Korean hospital medical interpretation dataset.",
                  "Evaluate the candidate against the Korean source, not against stylistic preference.",
                  "Preserve medical meaning, question/command/negation, numbers, units, body side, brands, and urgency.",
                  "Natural target-language grammar and equivalent patient-friendly phrasing are acceptable.",
                  "Do not mark a harmless punctuation or morphology difference as an error.",
                  "Fail for meaning loss, invented advice, wrong medical term, language mixing, direction reversal, or unsafe weakening.",
                  "Use review only when domain or institutional terminology genuinely needs a human decision.",
                  "Write reasonKo in concise Korean. If verdict is pass, correctedTranslation must be empty."
                ].join("\n")
              }]
            },
            {
              role: "user",
              content: [{
                type: "input_text",
                text: [
                  `Target language: ${params.row.targetLanguage}`,
                  `Specialty: ${params.row.specialty}`,
                  `Korean source: ${params.row.sourceText}`,
                  `Candidate translation: ${params.row.candidateTranslation}`,
                  `Deterministic flags: ${params.row.deterministicFailureReasons.join(", ") || "none"}`,
                  `Initial semantic status: ${params.row.semanticStatus}`,
                  `Initial semantic reason: ${params.row.semanticReason || "none"}`,
                  `Required terms or meaning: ${params.row.requiredTerms || "none"}`,
                  `Forbidden changes: ${params.row.forbiddenChanges || "none"}`,
                  `Risk: ${params.row.riskLevel}; ${params.row.riskTags.join(", ") || "none"}`
                ].join("\n")
              }]
            }
          ]
        }),
        signal: AbortSignal.timeout(45_000)
      });
      if (!response.ok) throw new Error(`provider_${response.status}:${(await response.text().catch(() => "")).slice(0, 200)}`);
      const payload = await response.json() as ResponsePayload;
      const parsed = JSON.parse(extractResponsesOutputText(payload)) as Adjudication;
      return {
        ...parsed,
        attempts: attempt,
        elapsedMs: Math.round(performance.now() - startedAt),
        inputTokens: Math.max(0, payload.usage?.input_tokens ?? 0),
        outputTokens: Math.max(0, payload.usage?.output_tokens ?? 0)
      };
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
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) throw new Error("OPENAI_API_KEY is not configured");
  const model = process.env.OPENAI_TEXT_TRANSLATION_MODEL?.trim() || "gpt-5.5";
  const inputPath = resolve(argument("input", "quality/results/full-primary3-gpt-5-5/results.jsonl"));
  const outputDir = resolve(argument("output-dir", "quality/results/full-primary3-gpt-5-5-adjudicated"));
  const inputRows = parseJsonl<SourceResult>(await readFile(inputPath, "utf8"));
  const rows = inputRows.filter((row) => row.status === "fail");
  await mkdir(outputDir, { recursive: true });
  const resultPath = join(outputDir, "adjudications.jsonl");
  await writeFile(resultPath, "", "utf8");
  const results: Array<SourceResult & Adjudication & {
    attempts: number; elapsedMs: number; inputTokens: number; outputTokens: number; estimatedCostUsd: number;
  }> = [];
  for (const row of rows) {
    const adjudication = await callAdjudicator({ apiKey, model, row });
    const estimatedCostUsd = (adjudication.inputTokens * 5 + adjudication.outputTokens * 30) / 1_000_000;
    const result = { ...row, ...adjudication, estimatedCostUsd };
    results.push(result);
    await appendFile(resultPath, `${JSON.stringify(result)}\n`, "utf8");
    console.log(JSON.stringify({ caseId: row.caseId, language: row.targetLanguage, verdict: adjudication.verdict, elapsedMs: adjudication.elapsedMs }));
  }
  const summary = {
    completedAt: new Date().toISOString(),
    model,
    sourceCount: inputRows.length,
    adjudicatedCount: results.length,
    verdicts: Object.fromEntries(["pass", "review", "fail"].map((verdict) => [verdict, results.filter((row) => row.verdict === verdict).length])),
    deterministicRuleVerdicts: Object.fromEntries(["true_error", "false_positive", "mixed", "not_applicable"].map((verdict) => [verdict, results.filter((row) => row.deterministicRuleVerdict === verdict).length])),
    totalEstimatedCostUsd: results.reduce((sum, row) => sum + row.estimatedCostUsd, 0),
    errorsByType: results.flatMap((row) => row.errorTypes).reduce<Record<string, number>>((counts, value) => {
      counts[value] = (counts[value] ?? 0) + 1;
      return counts;
    }, {})
  };
  await writeFile(join(outputDir, "summary.json"), JSON.stringify(summary, null, 2), "utf8");
  console.log(JSON.stringify(summary, null, 2));
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
