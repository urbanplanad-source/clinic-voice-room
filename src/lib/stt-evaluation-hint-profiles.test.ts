import { describe, expect, it } from "vitest";
import { buildSttEvaluationPrompt, getSttEvaluationHintProfile } from "./stt-evaluation-hint-profiles";

describe("STT evaluation hint profiles", () => {
  it("keeps code-v4 unchanged", () => {
    expect(getSttEvaluationHintProfile("code-v4").hints).toContain("특정 약재");
  });

  it("adds full allergy context only to the candidate", () => {
    const candidate = getSttEvaluationHintProfile("code-v5-candidate");
    expect(candidate.hints).toContain("특정 약재에 알레르기가 있나요?");
    expect(candidate.hints).not.toContain("특정 약재");
    expect(candidate.hints).toContain("약재");
  });

  it("adds a bounded context rule for the second candidate", () => {
    const candidate = buildSttEvaluationPrompt("code-v5-context-candidate");
    expect(candidate.prompt).toContain("write 약재");
    expect(candidate.prompt).toContain("not 약제");
    expect(candidate.prompt.length).toBeLessThanOrEqual(1024);
  });
  it("adds all approved medical ambiguity rules to the v6 candidate", () => {
    const candidate = buildSttEvaluationPrompt("code-v6-medical-safety-candidate");
    expect(candidate.prompt).toContain("약재 (medicinal herb), not 약제");
    expect(candidate.prompt).toContain("사용할, not 사용한");
    expect(candidate.prompt).toContain("보형물");
    expect(candidate.prompt).toContain("2cc");
    expect(candidate.prompt.length).toBeLessThanOrEqual(1024);
  });
  it("rejects unknown profiles", () => {
    expect(() => getSttEvaluationHintProfile("unknown")).toThrow("Unknown STT hint profile");
  });
});
