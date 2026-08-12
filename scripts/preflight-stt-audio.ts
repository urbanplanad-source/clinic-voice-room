import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import { promisify } from "node:util";
import { evaluateAudioPreflight, type AudioProbe } from "../src/lib/stt-audio-preflight";
import type { SttEvaluationCase } from "../src/lib/stt-evaluation";

const execFileAsync = promisify(execFile);

function argument(name: string, fallback?: string) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

async function probeAudio(path: string): Promise<AudioProbe> {
  const fileName = basename(path);
  const bytes = await readFile(path);
  const fileStat = await stat(path);
  const base = {
    fileName,
    sizeBytes: fileStat.size,
    sha256: createHash("sha256").update(bytes).digest("hex")
  };
  try {
    const { stdout } = await execFileAsync("ffprobe", [
      "-v", "error",
      "-show_entries", "format=duration,format_name:stream=codec_type,codec_name,sample_rate,channels",
      "-of", "json",
      path
    ], { maxBuffer: 1024 * 1024 });
    const metadata = JSON.parse(stdout) as {
      format?: { duration?: string; format_name?: string };
      streams?: Array<{ codec_type?: string; codec_name?: string; sample_rate?: string; channels?: number }>;
    };
    const stream = metadata.streams?.find((candidate) => candidate.codec_type === "audio");
    const volume = await execFileAsync("ffmpeg", [
      "-nostdin", "-hide_banner", "-i", path, "-af", "volumedetect", "-f", "null",
      process.platform === "win32" ? "NUL" : "/dev/null"
    ], { maxBuffer: 2 * 1024 * 1024 }).catch((error: unknown) => {
      const output = typeof error === "object" && error && "stderr" in error ? String(error.stderr) : "";
      return { stderr: output };
    });
    const volumeText = String(volume.stderr ?? "");
    const meanMatch = volumeText.match(/mean_volume:\s*(-?[\d.]+) dB/iu);
    const maxMatch = volumeText.match(/max_volume:\s*(-?[\d.]+) dB/iu);
    return {
      ...base,
      durationSeconds: metadata.format?.duration ? Number(metadata.format.duration) : undefined,
      formatName: metadata.format?.format_name,
      audioCodec: stream?.codec_name,
      sampleRate: stream?.sample_rate ? Number(stream.sample_rate) : undefined,
      channels: stream?.channels,
      meanVolumeDb: meanMatch ? Number(meanMatch[1]) : undefined,
      maxVolumeDb: maxMatch ? Number(maxMatch[1]) : undefined
    };
  } catch (error) {
    return { ...base, probeError: error instanceof Error ? error.message : String(error) };
  }
}

async function main() {
  const audioDirArgument = argument("audio-dir");
  if (!audioDirArgument) throw new Error("--audio-dir is required");
  const audioDir = resolve(audioDirArgument);
  const setId = argument("set-id", basename(audioDir))!;
  const inputPath = resolve(argument("input", "quality/golden/stt/medical-korean-stt-cases-v3.jsonl")!);
  const outputPath = resolve(argument("output", `quality/results/stt-preflight/${setId}.json`)!);
  const cases = (await readFile(inputPath, "utf8")).split(/\r?\n/u).filter(Boolean).map((line) => JSON.parse(line) as SttEvaluationCase);
  const discoveredFileNames = await readdir(audioDir);
  const expectedPaths = cases
    .map((testCase) => join(audioDir, `${testCase.id}.mp3`))
    .filter((path) => discoveredFileNames.some((name) => name.toLocaleLowerCase("en-US") === basename(path).toLocaleLowerCase("en-US")));
  const probes = await Promise.all(expectedPaths.map(probeAudio));
  const evaluation = evaluateAudioPreflight({
    expectedCaseIds: cases.map((testCase) => testCase.id),
    discoveredFileNames,
    probes
  });
  const result = {
    checkedAt: new Date().toISOString(),
    setId,
    audioDir,
    privacyReminder: "실제 환자정보와 식별정보가 포함된 음성은 평가하지 않습니다.",
    ...evaluation,
    probes
  };
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({ outputPath, ...evaluation }, null, 2));
  if (!evaluation.ready) process.exitCode = 2;
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
