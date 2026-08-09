import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { patientLanguages, patientLanguageTags } from "../lib/languages";

describe("MediVoice 0.3.39 P0 UI contracts", () => {
  it("defines a BCP 47 language tag for every supported patient language", () => {
    expect(Object.keys(patientLanguageTags).sort()).toEqual([...patientLanguages].sort());
    expect(patientLanguageTags.zh).toBe("zh-CN");
    expect(patientLanguageTags.zh_tw).toBe("zh-TW");
    expect(patientLanguageTags.yue).toBe("yue-Hant-HK");
    expect(patientLanguageTags.tl).toBe("fil");
  });

  it("uses the multilingual unavailable component instead of hardcoded English", () => {
    const route = readFileSync(new URL("../app/room/patient/[roomId]/page.tsx", import.meta.url), "utf8");
    expect(route).toContain("PatientRoomUnavailable");
    expect(route).not.toContain("Room not available");
  });

  it("uses exact turn phases and no developer-status regex", () => {
    const room = readFileSync(new URL("./VoiceRoom.tsx", import.meta.url), "utf8");
    for (const phase of ["idle", "connecting", "listening", "transcribing", "translating", "verifying", "fallback", "speaking", "error"]) {
      expect(room).toContain('| "' + phase + '"');
    }
    expect(room).toContain('turnPhase === "connecting"');
    expect(room).not.toContain("/preparing|준비/i");
    expect(room).not.toContain("setRealtimeStatus");
  });

  it("keeps consultation rooms inside the room viewport without height magic numbers", () => {
    const frame = readFileSync(new URL("./AppFrame.tsx", import.meta.url), "utf8");
    const room = readFileSync(new URL("./ConsultationChatRoom.tsx", import.meta.url), "utf8");
    expect(frame).toContain("roomViewport");
    expect(frame).toContain("h-dvh");
    expect(room).toContain("h-full min-h-0");
    expect(room).not.toContain("calc(100dvh-56px)");
  });
});