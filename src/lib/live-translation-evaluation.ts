import { z } from "zod";

export const liveEvaluationSourceCaseSchema = z.object({
  id: z.string().min(1),
  semanticGroupId: z.string().min(1),
  specialty: z.string().min(1),
  scenario: z.string(),
  subcategory: z.string(),
  speaker: z.string(),
  sourceDirection: z.string(),
  evaluationDirection: z.enum(["ko_to_patient", "reverse_seed_required"]),
  speechAct: z.string(),
  standardKo: z.string().min(1),
  spokenVariantsKo: z.string(),
  contextNoteKo: z.string(),
  primaryRiskType: z.string(),
  riskFlags: z.string(),
  riskLevel: z.string(),
  requiredTerms: z.string(),
  forbiddenChanges: z.string(),
  sourceQaStatus: z.string(),
  humanApproved: z.boolean(),
  sourceWorkbook: z.string()
}).strict();

export type LiveEvaluationSourceCase = z.infer<typeof liveEvaluationSourceCaseSchema>;

export type LiveEvaluationResult = {
  runId: string;
  caseId: string;
  semanticGroupId: string;
  specialty: string;
  targetLanguage: string;
  repeat: number;
  sourceText: string;
  candidateTranslation?: string;
  correctedTranslation?: string;
  model: string;
  status: "pass" | "review" | "fail" | "error";
  deterministicStatus: "pass" | "fail";
  deterministicFailureReasons: string[];
  semanticStatus: "pass" | "fail" | "unavailable";
  semanticReason?: string;
  translationMs: number;
  validationMs: number;
  totalMs: number;
  translationAttempts?: number;
  validationAttempts?: number;
  inputTokens: number;
  outputTokens: number;
  estimatedCostUsd: number;
  riskLevel: string;
  riskTags: string[];
  requiredTerms: string;
  forbiddenChanges: string;
  sourceQaStatus: string;
  error?: string;
};

function riskRank(value: string) {
  if (value === "critical") return 0;
  if (value === "high") return 1;
  if (value === "medium") return 2;
  return 3;
}

export function parseLiveEvaluationSourceJsonl(text: string) {
  const rows: LiveEvaluationSourceCase[] = [];
  const errors: string[] = [];
  const ids = new Set<string>();
  for (const [index, line] of text.split(/\r?\n/u).entries()) {
    if (!line.trim()) continue;
    try {
      const row = liveEvaluationSourceCaseSchema.parse(JSON.parse(line));
      if (ids.has(row.id)) errors.push(`duplicate id: ${row.id}`);
      ids.add(row.id);
      rows.push(row);
    } catch (caught) {
      errors.push(`line ${index + 1}: ${caught instanceof Error ? caught.message : "invalid row"}`);
    }
  }
  return { rows, errors };
}

export function selectStratifiedLiveCases(rows: LiveEvaluationSourceCase[], perSpecialty: number) {
  const eligible = rows.filter((row) => row.evaluationDirection === "ko_to_patient" && row.sourceQaStatus !== "fail");
  const specialties = [...new Set(eligible.map((row) => row.specialty))].sort();
  return specialties.flatMap((specialty) => eligible
    .filter((row) => row.specialty === specialty)
    .sort((left, right) => {
      const riskDifference = riskRank(left.riskLevel) - riskRank(right.riskLevel);
      return riskDifference || left.id.localeCompare(right.id);
    })
    .slice(0, perSpecialty));
}

export function percentile(values: number[], ratio: number) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * ratio))];
}

export function estimateTextModelCostUsd(params: {
  inputTokens: number;
  outputTokens: number;
  inputUsdPerMillion: number;
  outputUsdPerMillion: number;
}) {
  return (params.inputTokens * params.inputUsdPerMillion + params.outputTokens * params.outputUsdPerMillion) / 1_000_000;
}

export function summarizeLiveEvaluation(results: LiveEvaluationResult[]) {
  const counts = { pass: 0, review: 0, fail: 0, error: 0 };
  for (const result of results) counts[result.status] += 1;
  const grouped = <T extends string>(key: (row: LiveEvaluationResult) => T) => Object.fromEntries(
    [...new Set(results.map(key))].sort().map((value) => {
      const group = results.filter((row) => key(row) === value);
      return [value, {
        total: group.length,
        pass: group.filter((row) => row.status === "pass").length,
        review: group.filter((row) => row.status === "review").length,
        fail: group.filter((row) => row.status === "fail").length,
        error: group.filter((row) => row.status === "error").length
      }];
    })
  );
  return {
    total: results.length,
    ...counts,
    passRate: results.length ? counts.pass / results.length : 0,
    totalEstimatedCostUsd: results.reduce((sum, row) => sum + row.estimatedCostUsd, 0),
    latencyMs: {
      p50: percentile(results.map((row) => row.totalMs), 0.5),
      p95: percentile(results.map((row) => row.totalMs), 0.95),
      p99: percentile(results.map((row) => row.totalMs), 0.99)
    },
    bySpecialty: grouped((row) => row.specialty),
    byLanguage: grouped((row) => row.targetLanguage)
  };
}

