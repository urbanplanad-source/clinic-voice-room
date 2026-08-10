import { describe, expect, it } from "vitest";
import { hospitalAdminCanPerformGlossaryLifecycleAction } from "./glossary-lifecycle-policy";

describe("hospital glossary lifecycle permissions", () => {
  it("allows safe hospital terms and pronunciation hints", () => {
    expect(hospitalAdminCanPerformGlossaryLifecycleAction({ entryType: "term", standardKo: "피코토닝" }, "activate")).toBe(true);
    expect(hospitalAdminCanPerformGlossaryLifecycleAction({ entryType: "transcription_hint", standardKo: "써마지" }, "approve")).toBe(true);
  });

  it("requires internal approval for verified, critical and medically sensitive entries", () => {
    expect(hospitalAdminCanPerformGlossaryLifecycleAction({ entryType: "verified_sentence", standardKo: "시술을 중단하겠습니다." }, "activate")).toBe(false);
    expect(hospitalAdminCanPerformGlossaryLifecycleAction({ entryType: "critical_phrase", standardKo: "호흡이 어렵습니다." }, "activate")).toBe(false);
    expect(hospitalAdminCanPerformGlossaryLifecycleAction({ entryType: "term", standardKo: "약물 투여량", category: "dose" }, "activate")).toBe(false);
  });

  it("still lets a hospital administrator draft a new version for internal review", () => {
    expect(hospitalAdminCanPerformGlossaryLifecycleAction({ entryType: "verified_sentence", standardKo: "중단해 주세요." }, "new_version")).toBe(true);
  });
});
