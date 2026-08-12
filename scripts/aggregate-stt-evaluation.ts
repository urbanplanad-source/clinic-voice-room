import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import { aggregateSttEvaluationSets, type SttEvaluationResultRow, type SttEvaluationSet } from "../src/lib/stt-evaluation-aggregate";

function argument(name: string, fallback: string) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

async function findResultsFiles(root: string): Promise<string[]> {
  const entries = await readdir(root, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const path = join(root, entry.name);
    if (entry.isDirectory()) return findResultsFiles(path);
    return entry.isFile() && entry.name === "results.jsonl" ? [path] : [];
  }));
  return nested.flat();
}

function parseRows(text: string) {
  return text.split(/\r?\n/u).filter(Boolean).map((line) => JSON.parse(line) as SttEvaluationResultRow);
}

function csvCell(value: unknown) {
  const text = Array.isArray(value) ? value.join(" | ") : String(value ?? "");
  return `"${text.replaceAll('"', '""')}"`;
}

function issueCsv(rows: Array<SttEvaluationResultRow & { setId: string }>) {
  const headers = ["set_id", "case_id", "expected", "transcript", "missing_terms", "number_preserved", "unit_preserved", "latency_ms"];
  const lines = rows.map((row) => [
    row.setId, row.caseId, row.expectedText, row.transcript, row.score.missingTerms,
    row.score.numberPreserved, row.score.clinicalUnitPreserved, row.latencyMs
  ].map(csvCell).join(","));
  return `${headers.join(",")}\n${lines.join("\n")}\n`;
}

function percent(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}

function markdownReport(aggregate: ReturnType<typeof aggregateSttEvaluationSets>) {
  const before = aggregate.byCondition.without_prompt;
  const after = aggregate.byCondition.with_clinic_prompt;
  const gateRows = Object.entries(aggregate.gates).map(([key, passed]) => `| ${key} | ${passed ? "PASS" : "FAIL"} |`).join("\n");
  const setRows = Object.entries(aggregate.bySet).map(([setId, summary]) =>
    `| ${setId} | ${percent(summary.with_clinic_prompt.safetyPassRate)} | ${percent(summary.with_clinic_prompt.meanRequiredTermRecall)} | ${summary.with_clinic_prompt.latencyMs.p95} |`
  ).join("\n");
  return `# MediVoice 실제 음성 STT 통합 평가\n\n` +
    `- 최종 판정: **${aggregate.releaseStatus.toUpperCase()}**\n` +
    `- 기준선: ${aggregate.baselineIds.join(", ")}\n` +
    `- 녹음 세트: ${aggregate.setCount}\n` +
    `- 평가 발화: ${aggregate.utteranceCount}\n` +
    `- 실패: ${aggregate.failures.length}\n` +
    `- 사람 검토: ${aggregate.reviews.length}\n` +
    `- 안전성 회귀: ${aggregate.regressions.length}\n\n` +
    `## 힌트 적용 전후\n\n` +
    `| 지표 | 힌트 없음 | 병원 힌트 |\n|---|---:|---:|\n` +
    `| 안전성 통과율 | ${percent(before.safetyPassRate)} | ${percent(after.safetyPassRate)} |\n` +
    `| 핵심어 보존율 | ${percent(before.meanRequiredTermRecall)} | ${percent(after.meanRequiredTermRecall)} |\n` +
    `| 숫자 보존율 | ${percent(before.numberPreservationRate)} | ${percent(after.numberPreservationRate)} |\n` +
    `| 단위 보존율 | ${percent(before.clinicalUnitPreservationRate)} | ${percent(after.clinicalUnitPreservationRate)} |\n` +
    `| 정확 일치율 | ${percent(before.exactRate)} | ${percent(after.exactRate)} |\n` +
    `| p95 전사 지연 | ${before.latencyMs.p95}ms | ${after.latencyMs.p95}ms |\n\n` +
    `p95 힌트 추가 지연: ${aggregate.latencyOverheadP95Ms}ms\n\n` +
    `## 출시 게이트\n\n| 게이트 | 결과 |\n|---|---|\n${gateRows}\n\n` +
    `## 세트별 결과\n\n| 세트 | 안전성 | 핵심어 | p95 지연(ms) |\n|---|---:|---:|---:|\n${setRows}\n`;
}

async function main() {
  const resultsRoot = resolve(argument("results-root", "quality/results/stt-real"));
  const outputDir = resolve(argument("output-dir", "quality/results/stt-real-aggregate"));
  const files = await findResultsFiles(resultsRoot);
  if (files.length === 0) throw new Error(`No results.jsonl found under ${resultsRoot}`);
  const sets: SttEvaluationSet[] = [];
  for (const resultPath of files) {
    const resultDir = dirname(resultPath);
    const manifest = JSON.parse(await readFile(join(resultDir, "manifest.json"), "utf8")) as { baselineId?: string; setId?: string; caseCount?: number };
    if (!manifest.baselineId) throw new Error(`Missing baselineId in ${join(resultDir, "manifest.json")}`);
    if (!manifest.caseCount) throw new Error(`Missing caseCount in ${join(resultDir, "manifest.json")}`);
    sets.push({ setId: manifest.setId ?? basename(resultDir), baselineId: manifest.baselineId, expectedCaseCount: manifest.caseCount, rows: parseRows(await readFile(resultPath, "utf8")) });
  }
  const setPatternText = argument("set-pattern", "");
  const setPattern = setPatternText ? new RegExp(setPatternText, "u") : null;
  const selectedSets = setPattern ? sets.filter((set) => setPattern.test(set.setId)) : sets;
  if (selectedSets.length === 0) throw new Error(`No result sets matched --set-pattern ${setPatternText}`);
  const aggregate = aggregateSttEvaluationSets(selectedSets);
  await mkdir(outputDir, { recursive: true });
  await Promise.all([
    writeFile(join(outputDir, "aggregate.json"), `${JSON.stringify({ completedAt: new Date().toISOString(), ...aggregate }, null, 2)}\n`, "utf8"),
    writeFile(join(outputDir, "report.md"), markdownReport(aggregate), "utf8"),
    writeFile(join(outputDir, "failures.csv"), issueCsv(aggregate.failures), "utf8"),
    writeFile(join(outputDir, "reviews.csv"), issueCsv(aggregate.reviews), "utf8")
  ]);
  console.log(JSON.stringify({ outputDir, releaseStatus: aggregate.releaseStatus, setCount: aggregate.setCount, utteranceCount: aggregate.utteranceCount, failures: aggregate.failures.length, reviews: aggregate.reviews.length }, null, 2));
  if (aggregate.releaseStatus === "fail") process.exitCode = 2;
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
