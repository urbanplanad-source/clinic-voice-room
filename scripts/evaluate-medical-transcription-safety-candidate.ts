import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { assessMedicalTranscription } from "../src/lib/medical-transcription-safety";
import { scoreSttTranscript, type SttEvaluationCase } from "../src/lib/stt-evaluation";

type ResultRow = {
  caseId: string;
  condition: string;
  transcript: string;
};

async function filesBelow(root: string): Promise<string[]> {
  const entries = await readdir(root, { withFileTypes: true });
  const nested = await Promise.all(entries.map((entry) => {
    const target = path.join(root, entry.name);
    return entry.isDirectory() ? filesBelow(target) : Promise.resolve(entry.name === "results.jsonl" ? [target] : []);
  }));
  return nested.flat();
}

async function jsonl<T>(filePath: string) {
  return (await readFile(filePath, "utf8"))
    .split(/\r?\n/u)
    .filter(Boolean)
    .map((line) => JSON.parse(line) as T);
}

function safetyPass(testCase: SttEvaluationCase, transcript: string) {
  const score = scoreSttTranscript(testCase, transcript);
  return score.requiredTermRecall === 1 && score.numberPreserved && score.clinicalUnitPreserved;
}

async function evaluateSet(label: string, root: string, cases: Map<string, SttEvaluationCase>) {
  const rows = (await Promise.all((await filesBelow(root)).map((file) => jsonl<ResultRow>(file))))
    .flat()
    .filter((row) => row.condition === "with_clinic_prompt");
  let baselineFailures = 0;
  let candidateFailures = 0;
  let corrected = 0;
  let blocked = 0;

  const details = rows.map((row) => {
    const testCase = cases.get(row.caseId);
    if (!testCase) throw new Error(`Missing STT case ${row.caseId}`);
    const baselinePass = safetyPass(testCase, row.transcript);
    const assessment = assessMedicalTranscription(row.transcript);
    const candidateText = assessment.text ?? row.transcript;
    const candidatePass = assessment.status !== "retry_required" && safetyPass(testCase, candidateText);
    if (!baselinePass) baselineFailures += 1;
    if (!candidatePass) candidateFailures += 1;
    if (assessment.status === "corrected") corrected += 1;
    if (assessment.status === "retry_required") blocked += 1;
    return { ...row, baselinePass, candidatePass, candidateText, assessment };
  });

  return { label, total: rows.length, baselineFailures, candidateFailures, corrected, blocked, details };
}

async function main() {
  const caseRows = await jsonl<SttEvaluationCase>("quality/golden/stt/medical-korean-stt-cases-v3.jsonl");
  const cases = new Map(caseRows.map((row) => [row.id, row]));
  const evaluations = [
    await evaluateSet("Clean", "quality/results/stt-real-v5-context-eval3", cases),
    await evaluateSet("Pink noise SNR 20/10/5dB", "quality/results/stt-noise-v5-context-eval3", cases)
  ];
  const outputDir = "quality/results/stt-medical-safety-candidate-offline";
  await mkdir(outputDir, { recursive: true });
  await writeFile(path.join(outputDir, "results.json"), `${JSON.stringify(evaluations, null, 2)}\n`, "utf8");

  const table = evaluations.map((row) =>
    `| ${row.label} | ${row.total} | ${row.baselineFailures} | ${row.corrected} | ${row.blocked} | ${row.candidateFailures} |`
  ).join("\n");
  const report = [
    "# Medical transcription safety candidate offline replay",
    "",
    "Only `with_clinic_prompt` results are replayed. No new model call is made.",
    "The candidate performs only approved full-context corrections; unresolved ambiguity is counted as blocked.",
    "",
    "| Condition | Turns | Baseline safety failures | Full-context corrections | Blocked | Candidate safety failures |",
    "|---|---:|---:|---:|---:|---:|",
    table,
    "",
    "This replay validates deterministic post-processing, not automatic retranscription accuracy or real hospital noise."
  ].join("\n");
  await writeFile(path.join(outputDir, "report.md"), `${report}\n`, "utf8");
  console.log(report);
}

main().catch((caught) => {
  console.error(caught);
  process.exitCode = 1;
});

