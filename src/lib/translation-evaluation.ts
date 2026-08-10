import { z } from "zod";
import { analyzeDeterministicTranslation } from "./translation-quality";

export const evaluationSplits = ["training", "validation", "holdout", "production_replay"] as const;

export const translationEvaluationRowSchema = z.object({
  id: z.string().trim().min(1).max(120),
  semanticGroupId: z.string().trim().min(1).max(120),
  split: z.enum(evaluationSplits),
  specialty: z.string().trim().min(1).max(80),
  direction: z.enum(["ko_to_patient", "patient_to_ko"]),
  sourceLanguage: z.string().trim().min(2).max(20),
  targetLanguage: z.string().trim().min(2).max(20),
  sourceText: z.string().trim().min(1).max(4000),
  expectedTranslation: z.string().trim().min(1).max(4000),
  candidateTranslation: z.string().trim().max(4000).optional(),
  riskTags: z.array(z.string().trim().min(1).max(80)).max(30).default([]),
  humanApproved: z.boolean().default(false)
}).strict();

export type TranslationEvaluationRow = z.infer<typeof translationEvaluationRowSchema>;

export function parseTranslationEvaluationJsonl(text: string) {
  const rows: TranslationEvaluationRow[] = [];
  const errors: string[] = [];
  for (const [index, line] of text.split(/\r?\n/u).entries()) {
    if (!line.trim()) continue;
    try {
      rows.push(translationEvaluationRowSchema.parse(JSON.parse(line)));
    } catch (caught) {
      errors.push(`line ${index + 1}: ${caught instanceof Error ? caught.message : "invalid row"}`);
    }
  }
  return { rows, errors };
}

export function validateEvaluationSplitIsolation(rows: TranslationEvaluationRow[]) {
  const errors: string[] = [];
  const ids = new Set<string>();
  const groupSplits = new Map<string, Set<string>>();
  for (const row of rows) {
    if (ids.has(row.id)) errors.push(`duplicate id: ${row.id}`);
    ids.add(row.id);
    const splits = groupSplits.get(row.semanticGroupId) ?? new Set<string>();
    splits.add(row.split);
    groupSplits.set(row.semanticGroupId, splits);
  }
  for (const [semanticGroupId, splits] of groupSplits) {
    if (splits.size > 1) errors.push(`semantic group leakage: ${semanticGroupId} -> ${Array.from(splits).sort().join(",")}`);
  }
  return errors;
}

function normalizeReference(text: string) {
  return text.normalize("NFKC").toLocaleLowerCase().replace(/[\p{P}\p{S}\s]+/gu, "");
}

export function evaluateTranslationRows(rows: TranslationEvaluationRow[]) {
  const evaluated = rows.flatMap((row) => {
    const candidate = row.candidateTranslation?.trim();
    if (!candidate) return [];
    const deterministic = analyzeDeterministicTranslation({
      sourceText: row.sourceText,
      translatedText: candidate,
      direction: row.direction
    });
    return [{
      id: row.id,
      semanticGroupId: row.semanticGroupId,
      split: row.split,
      specialty: row.specialty,
      direction: row.direction,
      sourceLanguage: row.sourceLanguage,
      targetLanguage: row.targetLanguage,
      riskTags: row.riskTags,
      humanApproved: row.humanApproved,
      deterministicStatus: deterministic.status,
      failureReasons: deterministic.failureReasons,
      exactReferenceMatch: normalizeReference(candidate) === normalizeReference(row.expectedTranslation)
    }];
  });
  const total = evaluated.length;
  const pass = evaluated.filter((row) => row.deterministicStatus === "pass").length;
  const exact = evaluated.filter((row) => row.exactReferenceMatch).length;
  const issueCounts: Record<string, number> = {};
  for (const row of evaluated) {
    for (const reason of row.failureReasons) issueCounts[reason] = (issueCounts[reason] ?? 0) + 1;
  }
  return {
    summary: {
      total,
      deterministicPass: pass,
      deterministicFail: total - pass,
      deterministicPassRate: total ? pass / total : 0,
      exactReferenceMatch: exact,
      exactReferenceMatchRate: total ? exact / total : 0,
      issueCounts
    },
    rows: evaluated
  };
}
