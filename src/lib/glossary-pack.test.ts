import { generateKeyPairSync } from "node:crypto";
import { describe, expect, it } from "vitest";
import type { ClinicGlossaryData } from "./clinic-glossary";
import { createSignedGlossaryPack, verifySignedGlossaryPack } from "./glossary-pack";

const data: ClinicGlossaryData = {
  terms: [],
  criticalPhrases: [],
  transcriptionHints: ["리쥬란"],
  transcriptionHintMappings: [],
  verifiedSentences: [],
  metadata: { glossaryVersion: "gl-test", packVersion: "pack-test", normalizationVersion: 2 }
};

describe("signed glossary pack", () => {
  it("verifies an unchanged Ed25519 signed pack", () => {
    const { privateKey, publicKey } = generateKeyPairSync("ed25519");
    const pack = createSignedGlossaryPack({
      data,
      version: "hospital-a-2026.08.10.1",
      signingKeyId: "test-key",
      privateKeyPem: privateKey.export({ type: "pkcs8", format: "pem" }).toString(),
      createdAt: new Date("2026-08-10T00:00:00.000Z")
    });

    expect(pack.manifest.normalizationVersion).toBe(2);
    expect(verifySignedGlossaryPack(pack, publicKey.export({ type: "spki", format: "pem" }).toString())).toBe(true);
  });

  it("rejects a payload changed after signing", () => {
    const { privateKey, publicKey } = generateKeyPairSync("ed25519");
    const pack = createSignedGlossaryPack({
      data,
      version: "hospital-a-2026.08.10.1",
      signingKeyId: "test-key",
      privateKeyPem: privateKey.export({ type: "pkcs8", format: "pem" }).toString()
    });
    pack.payload.transcriptionHints.push("변조된 힌트");

    expect(verifySignedGlossaryPack(pack, publicKey.export({ type: "spki", format: "pem" }).toString())).toBe(false);
  });
});
