import { createHash } from "node:crypto";

export type SttEvaluationBaseline = {
  schemaVersion: 1;
  baselineId: string;
  glossaryVersion: string;
  transcriptionModel: string;
  normalizationVersion: number;
  promptLength: number;
  promptSha256: string;
  casesSha256: string;
  caseCount: number;
  caseIds: string[];
};

export function sha256Text(value: string) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

export function createSttEvaluationBaseline(input: {
  baselineId: string;
  glossaryVersion: string;
  transcriptionModel: string;
  normalizationVersion: number;
  prompt: string;
  casesText: string;
  caseIds: string[];
}): SttEvaluationBaseline {
  return {
    schemaVersion: 1,
    baselineId: input.baselineId,
    glossaryVersion: input.glossaryVersion,
    transcriptionModel: input.transcriptionModel,
    normalizationVersion: input.normalizationVersion,
    promptLength: input.prompt.length,
    promptSha256: sha256Text(input.prompt),
    casesSha256: sha256Text(input.casesText),
    caseCount: input.caseIds.length,
    caseIds: [...input.caseIds]
  };
}

export function verifySttEvaluationBaseline(
  expected: SttEvaluationBaseline,
  actual: SttEvaluationBaseline
) {
  const issues: string[] = [];
  const fields: Array<keyof Omit<SttEvaluationBaseline, "caseIds">> = [
    "schemaVersion",
    "baselineId",
    "glossaryVersion",
    "transcriptionModel",
    "normalizationVersion",
    "promptLength",
    "promptSha256",
    "casesSha256",
    "caseCount"
  ];
  for (const field of fields) {
    if (expected[field] !== actual[field]) {
      issues.push(`${field}: expected=${expected[field]} actual=${actual[field]}`);
    }
  }
  if (expected.caseIds.join("\n") !== actual.caseIds.join("\n")) {
    issues.push("caseIds: evaluation case order or membership changed");
  }
  return issues;
}
