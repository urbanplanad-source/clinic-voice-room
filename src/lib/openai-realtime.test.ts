import { describe, expect, it } from "vitest";
import { buildRealtimeTranslationInstructions } from "./openai-realtime";

describe("buildRealtimeTranslationInstructions", () => {
  it("locks Japanese patient speech to Korean translation", () => {
    const instructions = buildRealtimeTranslationInstructions("ja", "ko");

    expect(instructions).toContain("Translate the speaker from Japanese to Korean.");
    expect(instructions).toContain("Output only the translated utterance.");
    expect(instructions).toContain("Never answer the speaker");
    expect(instructions).toContain("predict the other participant's reply");
  });

  it("preserves the requested speech act", () => {
    const instructions = buildRealtimeTranslationInstructions("en", "ko");

    expect(instructions).toContain("questions must remain questions");
    expect(instructions).toContain("requests must remain requests");
    expect(instructions).toContain("statements must remain statements");
  });
});
