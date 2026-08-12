import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { scoreSttTranscript, summarizeSttScores, type SttEvaluationCase } from "../src/lib/stt-evaluation";
import type { SttEvaluationBaseline } from "../src/lib/stt-evaluation-baseline";

function argument(name: string, fallback?: string) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

function percentile(values: number[], ratio: number) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.floor((sorted.length - 1) * ratio)];
}

async function main() {
  const sourceDirArgument = argument("source-dir");
  const outputDirArgument = argument("output-dir");
  if (!sourceDirArgument || !outputDirArgument) throw new Error("--source-dir and --output-dir are required");
  const sourceDir = resolve(sourceDirArgument);
  const outputDir = resolve(outputDirArgument);
  const inputPath = resolve(argument("input", "quality/golden/stt/medical-korean-stt-cases-v3.jsonl")!);
  const baselinePath = resolve(argument("baseline", "quality/baselines/stt-code-v6-medical-safety-candidate-1024-eval3.json")!);
  if (await stat(join(outputDir, "results.jsonl")).then(() => true).catch(() => false)) {
    throw new Error(`Refusing to overwrite existing rescored results: ${outputDir}`);
  }
  const cases = (await readFile(inputPath, "utf8")).split(/\r?\n/u).filter(Boolean).map((line) => JSON.parse(line) as SttEvaluationCase);
  const casesById = new Map(cases.map((testCase) => [testCase.id, testCase]));
  const sourceRows = (await readFile(join(sourceDir, "results.jsonl"), "utf8"))
    .split(/\r?\n/u).filter(Boolean).map((line) => JSON.parse(line) as Record<string, unknown> & { caseId: string; condition: string; transcript: string; latencyMs: number });
  const rows = sourceRows.map((row) => {
    const testCase = casesById.get(row.caseId);
    if (!testCase) throw new Error(`Unknown caseId in source results: ${row.caseId}`);
    return {
      ...row,
      expectedText: testCase.expectedText,
      requiredTerms: testCase.requiredTerms,
      riskTags: testCase.riskTags,
      score: scoreSttTranscript(testCase, row.transcript)
    };
  });
  const baseline = JSON.parse(await readFile(baselinePath, "utf8")) as SttEvaluationBaseline;
  const sourceManifest = JSON.parse(await readFile(join(sourceDir, "manifest.json"), "utf8")) as Record<string, unknown>;
  const manifest = {
    ...sourceManifest,
    outputDir,
    inputPath,
    baselinePath,
    baselineId: baseline.baselineId,
    baseline,
    rescoredAt: new Date().toISOString(),
    rescoredFrom: sourceDir,
    apiCallsMade: 0
  };
  const byCondition = Object.fromEntries(["without_prompt", "with_clinic_prompt"].map((condition) => {
    const conditionRows = rows.filter((row) => row.condition === condition);
    const latencyValues = conditionRows.map((row) => Number(row.latencyMs));
    return [condition, {
      ...summarizeSttScores(conditionRows.map((row) => row.score)),
      latencyMs: { p50: percentile(latencyValues, 0.5), p95: percentile(latencyValues, 0.95) }
    }];
  }));
  const sourceSummary = JSON.parse(await readFile(join(sourceDir, "summary.json"), "utf8")) as Record<string, unknown>;
  const summary = { ...sourceSummary, rescoredAt: manifest.rescoredAt, baselineId: baseline.baselineId, byCondition };
  await mkdir(outputDir, { recursive: true });
  await Promise.all([
    writeFile(join(outputDir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8"),
    writeFile(join(outputDir, "results.jsonl"), `${rows.map((row) => JSON.stringify(row)).join("\n")}\n`, "utf8"),
    writeFile(join(outputDir, "summary.json"), `${JSON.stringify(summary, null, 2)}\n`, "utf8")
  ]);
  console.log(JSON.stringify({ outputDir, baselineId: baseline.baselineId, apiCallsMade: 0, byCondition }, null, 2));
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
