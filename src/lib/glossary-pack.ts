import { createHash, createPrivateKey, createPublicKey, sign, verify } from "node:crypto";
import type { ClinicGlossaryData } from "./clinic-glossary";

export const glossaryPackSignatureAlgorithm = "Ed25519" as const;

export type GlossaryPackPayload = {
  schemaVersion: 1;
  normalizationVersion: number;
  glossaryVersion: string;
  terms: ClinicGlossaryData["terms"];
  criticalPhrases: ClinicGlossaryData["criticalPhrases"];
  transcriptionHints: ClinicGlossaryData["transcriptionHints"];
  transcriptionHintMappings: NonNullable<ClinicGlossaryData["transcriptionHintMappings"]>;
  verifiedSentences: ClinicGlossaryData["verifiedSentences"];
};

export type GlossaryPackManifest = {
  version: string;
  createdAt: string;
  checksumSha256: string;
  signature: string;
  signatureAlgorithm: typeof glossaryPackSignatureAlgorithm;
  signingKeyId: string;
  normalizationVersion: number;
  minimumAppVersion?: string;
};

export type SignedGlossaryPack = {
  manifest: GlossaryPackManifest;
  payload: GlossaryPackPayload;
};

function canonicalize(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalize(record[key])}`)
    .join(",")}}`;
}

function packSignatureMessage(manifest: Pick<GlossaryPackManifest, "version" | "checksumSha256" | "normalizationVersion">) {
  return Buffer.from(`${manifest.version}\n${manifest.checksumSha256}\n${manifest.normalizationVersion}`, "utf8");
}

export function compileGlossaryPackPayload(data: ClinicGlossaryData): GlossaryPackPayload {
  return {
    schemaVersion: 1,
    normalizationVersion: data.metadata?.normalizationVersion ?? 1,
    glossaryVersion: data.metadata?.glossaryVersion ?? "legacy",
    terms: data.terms,
    criticalPhrases: data.criticalPhrases,
    transcriptionHints: data.transcriptionHints,
    transcriptionHintMappings: data.transcriptionHintMappings ?? [],
    verifiedSentences: data.verifiedSentences
  };
}

export function glossaryPackChecksum(payload: GlossaryPackPayload) {
  return createHash("sha256").update(canonicalize(payload), "utf8").digest("hex");
}

export function createSignedGlossaryPack(params: {
  data: ClinicGlossaryData;
  version: string;
  signingKeyId: string;
  privateKeyPem: string;
  createdAt?: Date;
  minimumAppVersion?: string;
}): SignedGlossaryPack {
  const payload = compileGlossaryPackPayload(params.data);
  const unsignedManifest = {
    version: params.version,
    checksumSha256: glossaryPackChecksum(payload),
    normalizationVersion: payload.normalizationVersion
  };
  const signature = sign(null, packSignatureMessage(unsignedManifest), createPrivateKey(params.privateKeyPem)).toString("base64");
  return {
    manifest: {
      ...unsignedManifest,
      createdAt: (params.createdAt ?? new Date()).toISOString(),
      signature,
      signatureAlgorithm: glossaryPackSignatureAlgorithm,
      signingKeyId: params.signingKeyId,
      ...(params.minimumAppVersion ? { minimumAppVersion: params.minimumAppVersion } : {})
    },
    payload
  };
}

export function verifySignedGlossaryPack(pack: SignedGlossaryPack, publicKeyPem: string) {
  if (pack.manifest.signatureAlgorithm !== glossaryPackSignatureAlgorithm) return false;
  if (pack.manifest.normalizationVersion !== pack.payload.normalizationVersion) return false;
  if (pack.manifest.checksumSha256 !== glossaryPackChecksum(pack.payload)) return false;
  return verify(
    null,
    packSignatureMessage(pack.manifest),
    createPublicKey(publicKeyPem),
    Buffer.from(pack.manifest.signature, "base64")
  );
}

