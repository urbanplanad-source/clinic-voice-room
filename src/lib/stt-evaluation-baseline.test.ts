import { describe, expect, it } from "vitest";
import { createSttEvaluationBaseline, verifySttEvaluationBaseline } from "./stt-evaluation-baseline";

describe("STT evaluation baseline", () => {
  const input = {
    baselineId: "code-v4",
    glossaryVersion: "code-v4",
    transcriptionModel: "gpt-4o-transcribe",
    normalizationVersion: 1,
    prompt: "한약, 약침",
    casesText: '{"id":"STT001"}\n',
    caseIds: ["STT001"]
  };

  it("creates a deterministic snapshot", () => {
    expect(createSttEvaluationBaseline(input)).toEqual(createSttEvaluationBaseline(input));
  });

  it("detects prompt and case drift", () => {
    const expected = createSttEvaluationBaseline(input);
    const actual = createSttEvaluationBaseline({
      ...input,
      prompt: "한약",
      caseIds: ["STT002"]
    });
    expect(verifySttEvaluationBaseline(expected, actual)).toEqual(expect.arrayContaining([
      expect.stringContaining("promptLength"),
      expect.stringContaining("promptSha256"),
      expect.stringContaining("caseIds")
    ]));
  });
});
