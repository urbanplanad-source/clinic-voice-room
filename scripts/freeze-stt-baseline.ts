import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { buildSttEvaluationPrompt } from "../src/lib/stt-evaluation-hint-profiles";
import {
  createSttEvaluationBaseline,
  verifySttEvaluationBaseline,
  type SttEvaluationBaseline
} from "../src/lib/stt-evaluation-baseline";
import type { SttEvaluationCase } from "../src/lib/stt-evaluation";

function argument(name: string, fallback: string) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

async function main() {
  const inputPath = resolve(argument("input", "quality/golden/stt/medical-korean-stt-cases-v3.jsonl"));
  const outputPath = resolve(argument("output", "quality/baselines/stt-code-v6-medical-safety-candidate-1024-eval3.json"));
  const casesText = await readFile(inputPath, "utf8");
  const hintProfile = buildSttEvaluationPrompt(argument("hint-profile", "code-v6-medical-safety-candidate"));
  const cases = casesText.split(/\r?\n/u).filter(Boolean).map((line) => JSON.parse(line) as SttEvaluationCase);
  const baseline = createSttEvaluationBaseline({
    baselineId: argument("baseline-id", "code-v6-medical-safety-candidate-1024-eval3"),
    glossaryVersion: argument("glossary-version", "code-v6-medical-safety-candidate"),
    transcriptionModel: argument("model", "gpt-4o-transcribe"),
    normalizationVersion: 1,
    prompt: hintProfile.prompt,
    casesText,
    caseIds: cases.map((testCase) => testCase.id)
  });
  const existingText = await readFile(outputPath, "utf8").catch(() => "");
  if (existingText) {
    const existing = JSON.parse(existingText) as SttEvaluationBaseline;
    const issues = verifySttEvaluationBaseline(existing, baseline);
    if (issues.length > 0) {
      throw new Error(
        `Refusing to overwrite frozen baseline ${outputPath}:\n- ${issues.join("\n- ")}\n` +
        "Create a new baseline ID and output file instead."
      );
    }
    console.log(JSON.stringify({ outputPath, unchanged: true, ...baseline }, null, 2));
    return;
  }
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(baseline, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({ outputPath, ...baseline }, null, 2));
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
