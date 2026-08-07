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

  it("keeps the emergency phrasebook virtualized and outside active interpretation", () => {
    const android = readFileSync(new URL("../../android-staff-app/app/src/main/java/com/clinicvoiceroom/staff/MainActivity.kt", import.meta.url), "utf8");
    expect(android).toContain("LazyColumn");
    expect(android).toContain("delay(250)");
    expect(android).toContain("비상용 안내 문장");
    expect(android).toContain("Please choose your language.");
    expect(android).toContain("val columnCount = if (maxWidth > maxHeight) 6 else 3");
    expect(android).toContain("선택 완료 · Confirm");
    expect(android).toContain('.then(if (screenKey == "language") Modifier else Modifier.verticalScroll');
    expect(android).not.toContain("confirmationStatus");
  });

  it("does not require patient taps for procedure-room messages", () => {
    const route = readFileSync(new URL("../app/api/procedure-turns/route.ts", import.meta.url), "utf8");
    expect(route).not.toContain("pendingPatientConfirmationGuard");
  });
});
