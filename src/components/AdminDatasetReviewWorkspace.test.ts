import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("AdminDatasetReviewWorkspace source contract", () => {
  it("keeps conflict resolution, review queue, and the release safety gate", () => {
    const source = readFileSync(new URL("./AdminDatasetReviewWorkspace.tsx", import.meta.url), "utf8");
    expect(source).toContain("승격 전 검토 워크스페이스");
    expect(source).toContain("충돌 결정");
    expect(source).toContain("검토 대기열");
    expect(source).toContain("한국어 승인");
    expect(source).toContain("17개 언어 번역·숫자 보존·의료 QA");
    expect(source).toContain("databaseWrite: false");
    expect(source).toContain("window.localStorage.setItem");
  });
});
