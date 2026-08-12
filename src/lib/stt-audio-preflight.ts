export type AudioProbe = {
  fileName: string;
  sizeBytes: number;
  durationSeconds?: number;
  formatName?: string;
  audioCodec?: string;
  sampleRate?: number;
  channels?: number;
  meanVolumeDb?: number;
  maxVolumeDb?: number;
  sha256?: string;
  probeError?: string;
};

export type PreflightIssue = {
  severity: "error" | "warning";
  code: string;
  fileName?: string;
  message: string;
};

export function evaluateAudioPreflight(input: {
  expectedCaseIds: string[];
  discoveredFileNames: string[];
  probes: AudioProbe[];
}) {
  const expectedNames = input.expectedCaseIds.map((id) => `${id}.mp3`);
  const expectedSet = new Set(expectedNames.map((name) => name.toLocaleLowerCase("en-US")));
  const discoveredSet = new Set(input.discoveredFileNames.map((name) => name.toLocaleLowerCase("en-US")));
  const issues: PreflightIssue[] = [];

  for (const fileName of expectedNames) {
    if (!discoveredSet.has(fileName.toLocaleLowerCase("en-US"))) {
      issues.push({ severity: "error", code: "missing_file", fileName, message: `필수 파일이 없습니다: ${fileName}` });
    }
  }
  for (const fileName of input.discoveredFileNames) {
    if (/^STT\d{3}\./iu.test(fileName) && !expectedSet.has(fileName.toLocaleLowerCase("en-US"))) {
      issues.push({
        severity: "error",
        code: "unexpected_or_unsupported_file",
        fileName,
        message: `예상하지 않은 파일명 또는 형식입니다: ${fileName}`
      });
    }
  }

  for (const probe of input.probes) {
    if (probe.probeError) {
      issues.push({ severity: "error", code: "invalid_audio", fileName: probe.fileName, message: probe.probeError });
      continue;
    }
    if (probe.sizeBytes < 1024) {
      issues.push({ severity: "error", code: "file_too_small", fileName: probe.fileName, message: "파일이 비어 있거나 지나치게 작습니다." });
    }
    if (!probe.audioCodec) {
      issues.push({ severity: "error", code: "audio_stream_missing", fileName: probe.fileName, message: "오디오 스트림을 찾지 못했습니다." });
    }
    if (probe.durationSeconds !== undefined && (probe.durationSeconds < 0.5 || probe.durationSeconds > 30)) {
      issues.push({ severity: "error", code: "invalid_duration", fileName: probe.fileName, message: `녹음 길이가 허용 범위(0.5~30초)를 벗어났습니다: ${probe.durationSeconds.toFixed(2)}초` });
    } else if (probe.durationSeconds !== undefined && (probe.durationSeconds < 1 || probe.durationSeconds > 20)) {
      issues.push({ severity: "warning", code: "unusual_duration", fileName: probe.fileName, message: `문장 녹음 길이를 확인하세요: ${probe.durationSeconds.toFixed(2)}초` });
    }
    if (probe.maxVolumeDb !== undefined && probe.maxVolumeDb <= -50) {
      issues.push({ severity: "error", code: "near_silence", fileName: probe.fileName, message: `음성이 거의 감지되지 않습니다: 최대 ${probe.maxVolumeDb.toFixed(1)} dB` });
    } else if (probe.meanVolumeDb !== undefined && probe.meanVolumeDb <= -40) {
      issues.push({ severity: "warning", code: "low_volume", fileName: probe.fileName, message: `평균 음량이 작습니다: ${probe.meanVolumeDb.toFixed(1)} dB` });
    }
  }

  const hashes = new Map<string, string[]>();
  for (const probe of input.probes) {
    if (!probe.sha256) continue;
    const names = hashes.get(probe.sha256) ?? [];
    names.push(probe.fileName);
    hashes.set(probe.sha256, names);
  }
  for (const names of hashes.values()) {
    if (names.length > 1) {
      issues.push({ severity: "error", code: "duplicate_audio", message: `동일한 음성 파일이 여러 문장에 사용되었습니다: ${names.join(", ")}` });
    }
  }

  return {
    ready: !issues.some((issue) => issue.severity === "error"),
    expectedCount: expectedNames.length,
    discoveredCount: input.discoveredFileNames.length,
    checkedCount: input.probes.length,
    errorCount: issues.filter((issue) => issue.severity === "error").length,
    warningCount: issues.filter((issue) => issue.severity === "warning").length,
    issues
  };
}
