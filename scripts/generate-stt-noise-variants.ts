import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const nullDevice = process.platform === "win32" ? "NUL" : "/dev/null";

function argument(name: string, fallback?: string) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

async function durationSeconds(path: string) {
  const { stdout } = await execFileAsync("ffprobe", [
    "-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", path
  ]);
  const value = Number(stdout.trim());
  if (!Number.isFinite(value) || value <= 0) throw new Error(`Invalid duration: ${path}`);
  return value;
}

function parseMeanVolume(text: string) {
  const match = text.match(/mean_volume:\s*(-?[\d.]+) dB/iu);
  if (!match) throw new Error("ffmpeg volumedetect did not return mean_volume");
  return Number(match[1]);
}

async function fileMeanVolumeDb(path: string) {
  const { stderr } = await execFileAsync("ffmpeg", [
    "-nostdin", "-hide_banner", "-i", path, "-af", "volumedetect", "-f", "null", nullDevice
  ], { maxBuffer: 2 * 1024 * 1024 });
  return parseMeanVolume(stderr);
}

function noiseSource(duration: number, seed: number) {
  return `anoisesrc=color=pink:sample_rate=48000:amplitude=1:duration=${duration.toFixed(6)}:seed=${seed}`;
}

async function noiseMeanVolumeDb(duration: number, seed: number) {
  const { stderr } = await execFileAsync("ffmpeg", [
    "-nostdin", "-hide_banner", "-f", "lavfi", "-i", noiseSource(duration, seed),
    "-af", "volumedetect", "-f", "null", nullDevice
  ], { maxBuffer: 2 * 1024 * 1024 });
  return parseMeanVolume(stderr);
}

async function main() {
  const inputDirArgument = argument("input-dir");
  if (!inputDirArgument) throw new Error("--input-dir is required");
  const inputDir = resolve(inputDirArgument);
  const setId = argument("set-id", basename(inputDir))!;
  const outputRoot = resolve(argument("output-root", `quality/audio/stt-noise/${setId}`)!);
  const levels = argument("snr", "20,10,5")!.split(",").map(Number);
  if (levels.some((level) => !Number.isFinite(level) || level < 0 || level > 40)) {
    throw new Error("--snr must contain comma-separated values from 0 to 40 dB");
  }
  const inputNames = (await readdir(inputDir)).filter((name) => /^STT\d{3}\.mp3$/iu.test(name)).sort();
  if (inputNames.length !== 12) throw new Error(`Expected 12 STT MP3 files, found ${inputNames.length}`);
  if (await stat(join(outputRoot, "noise-manifest.json")).then(() => true).catch(() => false)) {
    throw new Error(`Refusing to overwrite existing noise set: ${outputRoot}`);
  }
  const records: Array<Record<string, unknown>> = [];
  await mkdir(outputRoot, { recursive: true });
  for (let index = 0; index < inputNames.length; index += 1) {
    const fileName = inputNames[index];
    const inputPath = join(inputDir, fileName);
    const duration = await durationSeconds(inputPath);
    const speechMeanDb = await fileMeanVolumeDb(inputPath);
    const seed = 42001 + index;
    const rawNoiseMeanDb = await noiseMeanVolumeDb(duration, seed);
    const inputSha256 = createHash("sha256").update(await readFile(inputPath)).digest("hex");
    for (const snrDb of levels) {
      const variantId = `${setId}-pink-snr${snrDb}`;
      const outputDir = join(outputRoot, variantId);
      const outputPath = join(outputDir, fileName);
      await mkdir(outputDir, { recursive: true });
      const targetNoiseMeanDb = speechMeanDb - snrDb;
      const noiseGainDb = targetNoiseMeanDb - rawNoiseMeanDb;
      const filter = [
        "[0:a]aresample=48000,volume=-3dB[speech]",
        `[1:a]volume=${(noiseGainDb - 3).toFixed(3)}dB[noise]`,
        "[speech][noise]amix=inputs=2:duration=first:dropout_transition=0:normalize=0,alimiter=limit=0.98[out]"
      ].join(";");
      await execFileAsync("ffmpeg", [
        "-nostdin", "-hide_banner", "-loglevel", "error", "-n", "-i", inputPath,
        "-f", "lavfi", "-i", noiseSource(duration, seed),
        "-filter_complex", filter, "-map", "[out]", "-c:a", "libmp3lame", "-q:a", "2", outputPath
      ], { maxBuffer: 2 * 1024 * 1024 });
      records.push({
        setId, variantId, fileName, inputSha256, durationSeconds: duration, seed, noiseColor: "pink",
        targetSnrDb: snrDb, speechMeanDb, rawNoiseMeanDb, targetNoiseMeanDb, appliedNoiseGainDb: noiseGainDb,
        speechHeadroomDb: -3, outputPath
      });
    }
  }
  const manifest = {
    schemaVersion: 1,
    createdAt: new Date().toISOString(),
    setId,
    inputDir,
    outputRoot,
    levels,
    method: "global mean-volume SNR; deterministic seeded pink noise; no denoise or speech normalization; -3dB common headroom",
    limitation: "Synthetic pink noise does not reproduce real hospital conversations, reverberation, microphone distance, or clipping.",
    records
  };
  await writeFile(join(outputRoot, "noise-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({ outputRoot, setId, levels, sourceCount: inputNames.length, generatedCount: records.length }, null, 2));
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
