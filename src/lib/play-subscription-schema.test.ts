import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migrationSql = readFileSync(
  resolve(
    process.cwd(),
    "prisma",
    "migrations",
    "20260730221444_add_play_subscription_trial",
    "migration.sql"
  ),
  "utf8"
);

describe("Play subscription migration", () => {
  it("requires an exact 24 hour server-side trial window", () => {
    expect(migrationSql).toContain(
      `"trialEndsAt" = "trialStartedAt" + INTERVAL '24 hours'`
    );
  });

  it("keeps the subscription table out of public Data API access", () => {
    expect(migrationSql).toContain(
      'ALTER TABLE public."HospitalSubscription" ENABLE ROW LEVEL SECURITY;'
    );
    expect(migrationSql).toContain(
      'REVOKE ALL PRIVILEGES ON TABLE public."HospitalSubscription" FROM anon, authenticated;'
    );
    expect(migrationSql).not.toContain("CREATE POLICY");
  });

  it("does not backfill or activate existing hospitals", () => {
    expect(migrationSql).not.toContain("INSERT INTO");
  });
});
