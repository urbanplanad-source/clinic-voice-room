import { describe, expect, it } from "vitest";
import {
  buildKoreanClinicTranscriptionPrompt,
  changedTranscriptionSpan,
  findClinicTranscriptionAliasConflict,
  normalizeClinicSourceTranscript,
  prepareClinicTranscriptionContext,
  transcriptionMappingsFromTerms,
  type ClinicTranscriptionHintMapping
} from "./clinic-transcription";

const termMappings = transcriptionMappingsFromTerms([
  {
    standardKo: "써마지",
    spoken: ["써마지", "서마지", "서머지", "써머지", "熱瑪吉"],
    category: "device"
  },
  {
    standardKo: "울쎄라",
    spoken: ["울쎄라", "울새나", "웃음세라"],
    category: "device"
  }
]);

describe("clinic transcription context", () => {
  it("uses term aliases to canonicalize standalone transcription hints", () => {
    const context = prepareClinicTranscriptionContext(
      ["서머지", "써마지"],
      [
        ...termMappings,
        { standardKo: "서머지", spokenForms: [], source: "transcription_hint" }
      ]
    );

    expect(context.canonicalHints).toContain("써마지");
    expect(context.canonicalHints).not.toContain("서머지");
    expect(context.mappings.find((mapping) => mapping.standardKo === "써마지")?.spokenForms).toContain("서머지");
  });

  it("excludes an alias that points to multiple canonical forms", () => {
    const mappings: ClinicTranscriptionHintMapping[] = [
      { standardKo: "XERF", spokenForms: ["셀프 리프팅"], source: "transcription_hint" },
      { standardKo: "다른 시술", spokenForms: ["셀프 리프팅"], source: "transcription_hint" }
    ];
    const context = prepareClinicTranscriptionContext([], mappings);

    expect(context.conflicts).toHaveLength(1);
    expect(context.conflicts[0].spokenForm).toBe("셀프 리프팅");
    expect(new Set(context.conflicts[0].standardForms)).toEqual(new Set(["XERF", "다른 시술"]));
    expect(context.mappings).toHaveLength(0);
  });

  it("detects alias conflicts after whitespace and Unicode normalization", () => {
    expect(findClinicTranscriptionAliasConflict("울쎄라", ["셀프 리프팅"], [
      { id: "other", standardKo: "XERF", spokenForms: ["셀프리프팅"] }
    ])).toEqual({ entryId: "other", spokenForm: "셀프 리프팅", standardKo: "XERF" });
  });

  it("keeps the prompt within its character budget and reports omitted items", () => {
    const hints = Array.from({ length: 100 }, (_, index) => `긴 시술 안내 문장 ${index}`);
    const details = buildKoreanClinicTranscriptionPrompt(hints, termMappings, 650);

    expect(details.prompt.length).toBeLessThanOrEqual(650);
    expect(details.truncated).toBe(true);
    expect(details.omittedHintCount).toBeGreaterThan(0);
    expect(details.omittedHints).toHaveLength(details.omittedHintCount);
  });

  it("uses spare prompt capacity for mappings without dropping canonical hints", () => {
    const longMapping: ClinicTranscriptionHintMapping = {
      standardKo: "검증 시술",
      spokenForms: ["가".repeat(95), "나".repeat(95)],
      source: "transcription_hint"
    };
    const details = buildKoreanClinicTranscriptionPrompt(["검증 시술"], [longMapping], 700);

    expect(details.prompt.length).toBeLessThanOrEqual(700);
    expect(details.mappingCount).toBe(1);
    expect(details.omittedHintCount).toBe(0);
    expect(details.omittedHints).toEqual([]);
    expect(details.prompt).toContain("-> 검증 시술");
  });

  it("normalizes only configured Korean acoustic variants", () => {
    expect(normalizeClinicSourceTranscript("서머지 600샷과 웃음세라 시술", [], termMappings)).toBe(
      "써마지 600샷과 울쎄라 시술"
    );
    expect(normalizeClinicSourceTranscript("40점만 더 하겠습니다", [], termMappings)).toBe(
      "40점만 더 하겠습니다"
    );
  });

  it("extracts the changed token span for sample promotion", () => {
    expect(changedTranscriptionSpan(
      "서머지 600샷으로 안내해 드릴게요.",
      "써마지 600샷으로 안내해 드릴게요."
    )).toEqual({ observedForm: "서머지", canonicalForm: "써마지" });
  });
});
