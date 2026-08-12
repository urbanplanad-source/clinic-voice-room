import { describe, expect, it } from "vitest";
import { evaluateAudioPreflight } from "./stt-audio-preflight";

describe("evaluateAudioPreflight", () => {
  it("accepts complete, audible, unique recordings", () => {
    const result = evaluateAudioPreflight({
      expectedCaseIds: ["STT001", "STT002"],
      discoveredFileNames: ["STT001.mp3", "STT002.mp3"],
      probes: [
        { fileName: "STT001.mp3", sizeBytes: 5000, durationSeconds: 3, audioCodec: "mp3", meanVolumeDb: -22, maxVolumeDb: -3, sha256: "a" },
        { fileName: "STT002.mp3", sizeBytes: 6000, durationSeconds: 4, audioCodec: "mp3", meanVolumeDb: -25, maxVolumeDb: -4, sha256: "b" }
      ]
    });
    expect(result.ready).toBe(true);
    expect(result.errorCount).toBe(0);
  });

  it("blocks missing, silent, duplicate, and unsupported recordings", () => {
    const result = evaluateAudioPreflight({
      expectedCaseIds: ["STT001", "STT002"],
      discoveredFileNames: ["STT001.mp3", "STT002.m4a"],
      probes: [
        { fileName: "STT001.mp3", sizeBytes: 5000, durationSeconds: 3, audioCodec: "mp3", meanVolumeDb: -70, maxVolumeDb: -60, sha256: "same" },
        { fileName: "STT002.m4a", sizeBytes: 5000, durationSeconds: 3, audioCodec: "aac", sha256: "same" }
      ]
    });
    expect(result.ready).toBe(false);
    expect(result.issues.map((issue) => issue.code)).toEqual(expect.arrayContaining([
      "missing_file",
      "unexpected_or_unsupported_file",
      "near_silence",
      "duplicate_audio"
    ]));
  });
});
