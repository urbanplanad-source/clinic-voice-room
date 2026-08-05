import { describe, expect, it } from "vitest";
import { qualitySummary } from "./admin-usage";

describe("qualitySummary", () => {
  it("normalizes database numeric values and computes rates", () => {
    expect(qualitySummary({
      turnCount: "20",
      successCount: BigInt(17),
      retryCount: 2,
      errorCount: 1,
      correctedCount: 3,
      verifiedCount: 4,
      uploadCount: 5,
      resultP50Ms: "850.4",
      resultP95Ms: 2200,
      audioP50Ms: 1100,
      audioP95Ms: "3100",
      validationP50Ms: 240,
      validationP95Ms: 900
    })).toEqual({
      turnCount: 20,
      successRate: 0.85,
      retryRate: 0.1,
      errorRate: 0.05,
      correctionRate: 0.15,
      verifiedRate: 0.2,
      uploadRate: 0.25,
      resultP50Ms: 850.4,
      resultP95Ms: 2200,
      audioP50Ms: 1100,
      audioP95Ms: 3100,
      validationP50Ms: 240,
      validationP95Ms: 900
    });
  });

  it("returns safe zero values for an empty period", () => {
    expect(qualitySummary()).toMatchObject({
      turnCount: 0,
      successRate: 0,
      retryRate: 0,
      errorRate: 0,
      resultP95Ms: 0,
      audioP95Ms: 0
    });
  });
});
