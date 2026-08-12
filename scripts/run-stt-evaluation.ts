import { mkdir, readFile, stat, writeFile, appendFile } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import { normalizedTranscriptionModel } from "../src/lib/openai-models";
import { buildSttEvaluationPrompt } from "../src/lib/stt-evaluation-hint-profiles";
import {
  createSttEvaluationBaseline,
  verifySttEvaluationBaseline,
  type SttEvaluationBaseline
} from "../src/lib/stt-evaluation-baseline";
import { scoreSttTranscript, summarizeSttScores, type SttEvaluationCase } from "../src/lib/stt-evaluation";

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

function parseCases(text: string) {
  return text.split(/\r?\n/u).filter(Boolean).map((line) => JSON.parse(line) as SttEvaluationCase);
}

async function exists(path: string) {
  return stat(path).then(() => true).catch(() => false);
}

async function synthesize(apiKey: string, model: string, testCase: SttEvaluationCase, outputPath: string) {
  const body = { model, voice: "alloy", input: testCase.expectedText, response_format: "mp3" };
  const response = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(60_000)
  });
  if (!response.ok) throw new Error(`tts_${response.status}:${(await response.text().catch(() => "")).slice(0, 200)}`);
  await writeFile(outputPath, new Uint8Array(await response.arrayBuffer()));
}

async function transcribe(params: { apiKey: string; model: string; audioPath: string; prompt?: string }) {
  const startedAt = performance.now();
  const bytes = await readFile(params.audioPath);
  const form = new FormData();
  form.set("file", new Blob([new Uint8Array(bytes)]), basename(params.audioPath));
  form.set("model", params.model);
  form.set("language", "ko");
  form.set("response_format", "json");
  if (params.prompt) form.set("prompt", params.prompt);
  const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${params.apiKey}` },
    body: form,
    signal: AbortSignal.timeout(60_000)
  });
  if (!response.ok) throw new Error(`transcription_${response.status}:${(await response.text().catch(() => "")).slice(0, 200)}`);
  const payload = await response.json() as { text?: string };
  return { transcript: payload.text?.trim() ?? "", latencyMs: Math.round(performance.now() - startedAt) };
}

async function main() {
  await loadLocalEnv();
  const inputPath = resolve(argument("input", "quality/golden/stt/medical-korean-stt-cases-v3.jsonl")!);
  const audioDir = resolve(argument("audio-dir", "quality/audio/synthetic-stt-code-v6-medical-safety-candidate")!);
  const outputDir = resolve(argument("output-dir", "quality/results/stt-code-v6-medical-safety-candidate")!);
  const setId = argument("set-id", basename(audioDir))!;
  const baselinePath = resolve(argument("baseline", "quality/baselines/stt-code-v6-medical-safety-candidate-1024-eval3.json")!);
  const casesText = await readFile(inputPath, "utf8");
  const cases = parseCases(casesText);
  const onlyCaseId = argument("only-case");
  const repeatCount = Number(argument("repeat", "1"));
  if (!Number.isInteger(repeatCount) || repeatCount < 1 || repeatCount > 10) throw new Error("--repeat must be an integer from 1 to 10");
  const evaluationCases = onlyCaseId ? cases.filter((testCase) => testCase.id === onlyCaseId) : cases;
  if (evaluationCases.length === 0) throw new Error(`Unknown --only-case: ${onlyCaseId}`);
  const conditionArgument = argument("condition", "both");
  if (!conditionArgument || !["both", "without_prompt", "with_clinic_prompt"].includes(conditionArgument)) {
    throw new Error("--condition must be both, without_prompt, or with_clinic_prompt");
  }
  const evaluationConditions: Array<"without_prompt" | "with_clinic_prompt"> = conditionArgument === "both"
    ? ["without_prompt", "with_clinic_prompt"]
    : [conditionArgument as "without_prompt" | "with_clinic_prompt"];
  const hintProfile = buildSttEvaluationPrompt(argument("hint-profile", "code-v6-medical-safety-candidate")!);
  const clinicPrompt = hintProfile.prompt;
  const transcriptionModel = normalizedTranscriptionModel(process.env.OPENAI_TRANSCRIPTION_MODEL);
  const expectedBaseline = JSON.parse(await readFile(baselinePath, "utf8")) as SttEvaluationBaseline;
  const actualBaseline = createSttEvaluationBaseline({
    baselineId: expectedBaseline.baselineId,
    glossaryVersion: expectedBaseline.glossaryVersion,
    transcriptionModel,
    normalizationVersion: expectedBaseline.normalizationVersion,
    prompt: clinicPrompt,
    casesText,
    caseIds: cases.map((testCase) => testCase.id)
  });
  const baselineIssues = verifySttEvaluationBaseline(expectedBaseline, actualBaseline);
  if (baselineIssues.length > 0) {
    throw new Error(`STT baseline mismatch (${baselinePath}):\n- ${baselineIssues.join("\n- ")}`);
  }
  const manifest = {
    createdAt: new Date().toISOString(), setId, hintProfileId: hintProfile.id, inputPath, audioDir, outputDir, caseCount: cases.length, evaluatedCaseIds: evaluationCases.map((testCase) => testCase.id), repeatCount,
    baselinePath, baselineId: expectedBaseline.baselineId, baseline: actualBaseline,
    conditions: evaluationConditions,
    audioSource: hasFlag("synthesize-missing") ? "synthetic_or_mixed" : "provided_recordings",
    syntheticAudio: hasFlag("synthesize-missing"),
    limitations: hasFlag("synthesize-missing")
      ? ["synthetic Korean speech is not a substitute for real clinic voices", "no ambient-noise or microphone variability"]
      : ["STT API latency only; excludes capture, network orchestration, translation, validation, and TTS"]
  };
  await mkdir(outputDir, { recursive: true });
  await writeFile(join(outputDir, "manifest.json"), JSON.stringify(manifest, null, 2), "utf8");
  if (hasFlag("dry-run")) {
    console.log(JSON.stringify({ dryRun: true, ...manifest }, null, 2));
    return;
  }

  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) throw new Error("OPENAI_API_KEY is not configured");
  const ttsModel = process.env.OPENAI_TTS_MODEL?.trim() || "gpt-4o-mini-tts";
  await mkdir(audioDir, { recursive: true });
  const resultPath = join(outputDir, "results.jsonl");
  await writeFile(resultPath, "", "utf8");
  const results: Array<Record<string, unknown> & { condition: string; score: ReturnType<typeof scoreSttTranscript> }> = [];

  for (const testCase of evaluationCases) {
    const audioPath = join(audioDir, `${testCase.id}.mp3`);
    if (!(await exists(audioPath))) {
      if (!hasFlag("synthesize-missing")) throw new Error(`Missing audio: ${audioPath}`);
      await synthesize(apiKey, ttsModel, testCase, audioPath);
    }
    for (let attempt = 1; attempt <= repeatCount; attempt += 1) {
      for (const condition of evaluationConditions) {
        const response = await transcribe({
          apiKey, model: transcriptionModel, audioPath,
          prompt: condition === "with_clinic_prompt" ? clinicPrompt : undefined
        });
        const result = {
          caseId: testCase.id, attempt, condition, expectedText: testCase.expectedText, transcript: response.transcript,
          requiredTerms: testCase.requiredTerms, riskTags: testCase.riskTags, latencyMs: response.latencyMs,
          transcriptionModel, ttsModel, score: scoreSttTranscript(testCase, response.transcript)
        };
        results.push(result);
        await appendFile(resultPath, `${JSON.stringify(result)}\n`, "utf8");
        console.log(JSON.stringify({ caseId: testCase.id, attempt, condition, transcript: result.transcript, exact: result.score.exactNormalized, termRecall: result.score.requiredTermRecall }));
      }
    }
  }

  const percentile = (values: number[], ratio: number) => {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    return sorted[Math.floor((sorted.length - 1) * ratio)];
  };
  const byCondition = Object.fromEntries(["without_prompt", "with_clinic_prompt"].map((condition) => {
    const conditionRows = results.filter((row) => row.condition === condition);
    const latencyValues = conditionRows.map((row) => Number(row.latencyMs));
    return [
      condition,
      {
        ...summarizeSttScores(conditionRows.map((row) => row.score)),
        latencyMs: { p50: percentile(latencyValues, 0.5), p95: percentile(latencyValues, 0.95) }
      }
    ];
  }));
  const summary = { completedAt: new Date().toISOString(), transcriptionModel, ttsModel, byCondition };
  await writeFile(join(outputDir, "summary.json"), JSON.stringify(summary, null, 2), "utf8");
  console.log(JSON.stringify(summary, null, 2));
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
