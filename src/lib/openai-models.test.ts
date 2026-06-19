import { describe, expect, it } from "vitest";
import { normalizedTextTranslationModel, normalizedTranscriptionModel } from "./openai-models";

describe("OpenAI model defaults", () => {
  it("defaults text translation to the current premium model", () => {
    expect(normalizedTextTranslationModel(undefined)).toBe("gpt-5.5");
    expect(normalizedTextTranslationModel("  gpt-5.5  ")).toBe("gpt-5.5");
  });

  it("keeps the current transcription default and legacy normalization", () => {
    expect(normalizedTranscriptionModel(undefined)).toBe("gpt-4o-transcribe");
    expect(normalizedTranscriptionModel("gpt-4o-mini-transcribe")).toBe("gpt-4o-transcribe");
  });
});
