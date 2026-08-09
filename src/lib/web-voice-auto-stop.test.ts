import { describe, expect, it, vi } from "vitest";
import { createVoiceActivityTracker, voiceLevelBucket } from "./web-voice-auto-stop";

const trackerOptions = {
  startedAt: 1000,
  minRecordingMs: 1000,
  minVoiceMs: 220,
  silenceMs: 1600,
  rmsThreshold: 0.018,
  peakThreshold: 0.06
};

describe("web voice activity feedback", () => {
  it("maps RMS and peak ratios into stable five-level buckets", () => {
    expect(voiceLevelBucket(0, 0)).toBe(0);
    expect(voiceLevelBucket(0.008, 0)).toBe(1);
    expect(voiceLevelBucket(0.014, 0)).toBe(2);
    expect(voiceLevelBucket(0.018, 0)).toBe(3);
    expect(voiceLevelBucket(0.04, 0)).toBe(4);
    expect(voiceLevelBucket(0, 0.12)).toBe(4);
  });

  it("shows the no-voice notice only after 2.5 seconds and clears it on first detected voice", () => {
    const changes: boolean[] = [];
    const tracker = createVoiceActivityTracker({
      ...trackerOptions,
      onNoVoiceChange: (visible) => changes.push(visible)
    });

    tracker.sample({ now: 3499, deltaMs: 16, rms: 0, peak: 0 });
    expect(changes).toEqual([]);

    tracker.sample({ now: 3500, deltaMs: 1, rms: 0, peak: 0 });
    expect(changes).toEqual([true]);

    tracker.sample({ now: 3520, deltaMs: 20, rms: 0.02, peak: 0.07 });
    expect(changes).toEqual([true, false]);
  });

  it("preserves the existing minimum voice and silence stop thresholds", () => {
    const tracker = createVoiceActivityTracker(trackerOptions);
    expect(tracker.sample({ now: 1300, deltaMs: 300, rms: 0.02, peak: 0.07 })).toBe(false);
    expect(tracker.sample({ now: 2899, deltaMs: 1599, rms: 0, peak: 0 })).toBe(false);
    expect(tracker.sample({ now: 2900, deltaMs: 1, rms: 0, peak: 0 })).toBe(true);
  });

  it("isolates UI callback failures from voice detection", () => {
    const tracker = createVoiceActivityTracker({
      ...trackerOptions,
      onLevel: () => {
        throw new Error("render callback failed");
      },
      onNoVoiceChange: () => {
        throw new Error("notice callback failed");
      }
    });

    expect(() => tracker.sample({ now: 3500, deltaMs: 2500, rms: 0, peak: 0 })).not.toThrow();
    expect(() => tracker.sample({ now: 3520, deltaMs: 20, rms: 0.02, peak: 0.07 })).not.toThrow();
  });

  it("notifies level changes without emitting duplicate buckets", () => {
    const onLevel = vi.fn();
    const tracker = createVoiceActivityTracker({ ...trackerOptions, onLevel });
    tracker.sample({ now: 1016, deltaMs: 16, rms: 0, peak: 0 });
    tracker.sample({ now: 1032, deltaMs: 16, rms: 0.001, peak: 0.001 });
    tracker.sample({ now: 1048, deltaMs: 16, rms: 0.02, peak: 0.07 });
    expect(onLevel).toHaveBeenCalledTimes(2);
    expect(onLevel).toHaveBeenLastCalledWith(3);
  });
});