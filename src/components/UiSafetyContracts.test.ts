import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("MediVoice UI safety contracts", () => {
  it("keeps full important text, explicit actions, replay and retry states", () => {
    const panel = readFileSync(new URL("./ImportantConfirmationPanel.tsx", import.meta.url), "utf8");
    expect(panel).toContain("whitespace-pre-wrap break-words");
    expect(panel).not.toContain("line-clamp");
    expect(panel).toContain("onConfirm");
    expect(panel).toContain("onRepeat");
    expect(panel).toContain("onReplay");
    expect(panel).toContain("onRetry");
    expect(panel).toContain('aria-live="assertive"');
  });

  it("keeps a cancel-first end-room confirmation and recovery check", () => {
    const dialog = readFileSync(new URL("./EndRoomDialog.tsx", import.meta.url), "utf8");
    expect(dialog).toContain("통역방을 종료하면 환자는 다시 입장할 수 없습니다");
    expect(dialog).toContain("autoFocus");
    expect(dialog).toContain("상태 다시 확인");
  });

  it("keeps Android phrasebook virtualization and in-room access", () => {
    const android = readFileSync(new URL("../../android-staff-app/app/src/main/java/com/clinicvoiceroom/staff/MainActivity.kt", import.meta.url), "utf8");
    expect(android).toContain("LazyColumn");
    expect(android).toContain("delay(250)");
    expect(android).toContain("onOpenPhrasebook");
    expect(android).toContain("recentLanguages");
    expect(android).toContain("환자가 다시 설명을 요청했습니다.");
  });
});
