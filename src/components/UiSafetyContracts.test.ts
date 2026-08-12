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
    expect(android).toContain('if (screenKey == "language" || fixedActionScreen) Modifier else Modifier.verticalScroll');
    expect(android).toContain('val fixedActionScreen = screenKey == "conversation" || screenKey == "ended"');
    expect(android).toContain("Role.RadioButton");
    expect(android).toContain("isNetworkConnectionRequired");
    expect(android).not.toContain("selectedLanguage = patientLanguage");
    expect(android).not.toContain("confirmationStatus");
  });

  it("discloses limited translation-text retention in the patient language", () => {
    const join = readFileSync(new URL("./PatientJoin.tsx", import.meta.url), "utf8");
    const privacy = readFileSync(new URL("../app/privacy/page.tsx", import.meta.url), "utf8");
    expect(join).toContain("patientPrivacyCopy");
    expect(join).toContain("privacyCopy.retention");
    expect(join).toContain("quality and safety review");
    expect(privacy).toContain("기본 30일");
  });

  it("does not require patient taps for procedure-room messages", () => {
    const route = readFileSync(new URL("../app/api/procedure-turns/route.ts", import.meta.url), "utf8");
    expect(route).not.toContain("pendingPatientConfirmationGuard");
  });

  it("keeps Android room actions visible and processing states explicit", () => {
    const android = readFileSync(new URL("../../android-staff-app/app/src/main/java/com/clinicvoiceroom/staff/MainActivity.kt", import.meta.url), "utf8");
    expect(android).toContain("ConversationRoomScreen(");
    expect(android).toContain("state.busy && state.localTurnDirection == LocalDirectionPatientToKo");
    expect(android).toContain('state.ttsPlaybackActive -> "음성 재생 중"');
    expect(android).toContain('contentDescription = "번역 음성 자동 재생"');
    expect(android).toContain('Text("현재 대화와 요약이 초기화됩니다."');
  });

  it("prioritizes procedure transcripts and keeps diagnostics screenshot-friendly", () => {
    const android = readFileSync(new URL("../../android-staff-app/app/src/main/java/com/clinicvoiceroom/staff/MainActivity.kt", import.meta.url), "utf8");

    expect(android).toContain('if (!procedureRoom) StatusPanel(state, metrics, onStatusTap)');
    expect(android).toContain('if (procedureRoom) StatusPanel(state, metrics, onStatusTap)');
    expect(android).toMatch(/SectionCard\("시술 통역", metrics\) \{[\s\S]*TranscriptBox\(sourceLabel[\s\S]*TranscriptBox\(translatedLabel[\s\S]*MicControlBox\([\s\S]*AutoPlayBar\(/);
    expect(android).toContain("diagnostics.rows().chunked(2).forEach");
    expect(android).toContain("private fun DiagnosticSummaryCell");
  });
});
