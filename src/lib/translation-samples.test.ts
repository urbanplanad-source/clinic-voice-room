import { beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { recordTranslationSample } from "@/lib/translation-samples";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    translationSample: {
      create: vi.fn()
    }
  }
}));

const sample = {
  hospitalId: "hospital-1",
  source: "local_voice" as const,
  mode: "local" as const,
  direction: "ko_to_patient",
  patientLanguage: "ja" as const,
  sourceText: "써마지 600샷입니다.",
  translatedText: "サーマクール600ショットです。",
  sourceLanguage: "ko",
  targetLanguage: "ja",
  messageId: "sample-message-id"
};

describe("recordTranslationSample", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("treats a serialized Prisma P2002 error as an idempotent duplicate", async () => {
    vi.mocked(prisma.translationSample.create).mockRejectedValue({
      name: "PrismaClientKnownRequestError",
      code: "P2002",
      meta: { target: ["hospitalId", "source", "messageId"] }
    });

    await expect(recordTranslationSample(sample)).resolves.toBeNull();
  });

  it("rethrows non-duplicate database errors", async () => {
    const databaseError = Object.assign(new Error("database unavailable"), { code: "P1001" });
    vi.mocked(prisma.translationSample.create).mockRejectedValue(databaseError);

    await expect(recordTranslationSample(sample)).rejects.toBe(databaseError);
  });
});
