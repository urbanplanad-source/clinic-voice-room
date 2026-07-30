import { describe, expect, it } from "vitest";
import { matchesRealtimeResponseId } from "./openai-realtime-client";

describe("matchesRealtimeResponseId", () => {
  it("accepts only the active response", () => {
    expect(matchesRealtimeResponseId("resp-current", "resp-current")).toBe(true);
  });

  it("rejects missing and stale response ids", () => {
    expect(matchesRealtimeResponseId("resp-current", "")).toBe(false);
    expect(matchesRealtimeResponseId("resp-current", "resp-previous")).toBe(false);
    expect(matchesRealtimeResponseId(null, "resp-current")).toBe(false);
  });
});
