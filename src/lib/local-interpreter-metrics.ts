import { prisma } from "./prisma";
import type { getCurrentStaff } from "./session";
import type { PatientLanguage } from "./languages";

type StaffSession = NonNullable<Awaited<ReturnType<typeof getCurrentStaff>>>;

export type LocalInterpreterMetricInput = {
  eventId: string;
  patientLanguage: PatientLanguage;
  direction: "ko_to_patient" | "patient_to_ko";
  transport: "realtime" | "upload" | "unknown";
  outcome: "success" | "retry_prompt" | "error";
  resultReadyMs?: number;
  audioStartedMs?: number;
  validationMs?: number;
  validationStatus?: "not_required" | "passed" | "repaired" | "unavailable" | "unresolved";
  corrected?: boolean;
  verifiedSentence?: boolean;
  errorCategory?: string;
  appVersion?: string;
  messageId?: string;
  packVersion?: string;
  glossaryVersion?: string;
  normalizationVersion?: number;
  modelId?: string;
  enginePath?: "realtime" | "upload_fallback" | "strict";
  turnEndMode?: "manual" | "silence" | "unknown";
  speechEndToTranscriptMs?: number;
  requestRoundTripMs?: number;
  exactMatchMs?: number;
  glossaryMatchMs?: number;
  translationMs?: number;
  correctionMs?: number;
  totalMs?: number;
  initialDeterministicStatus?: "pass" | "fail";
  finalDeterministicStatus?: "pass" | "fail";
  semanticStatus?: "pass" | "fail" | "not_required" | "unavailable";
  validationPath?: "standard" | "repair" | "strict";
  riskLevel?: "normal" | "high";
  riskReasons?: string[];
  matchedEntryIds?: string[];
  modelAttemptCount?: number;
  validationAttemptCount?: number;
  correctionAttemptCount?: number;
  strictAttemptCount?: number;
  retryRequiredCount?: number;
  estimatedCostUsd?: number;
};

function optionalMilliseconds(value: number | undefined, maximum: number) {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return Math.max(0, Math.min(maximum, Math.round(value)));
}

export async function recordLocalInterpreterTurnMetric(
  staff: StaffSession,
  input: LocalInterpreterMetricInput
) {
  const existing = await prisma.localInterpreterTurnMetric.findUnique({
    where: { id: input.eventId },
    select: { staffId: true }
  });
  if (existing && existing.staffId !== staff.id) {
    throw new Error("Metric event belongs to another staff account");
  }

  const inferredSemanticStatus = input.semanticStatus ?? (
    input.validationStatus === "passed" ? "pass" :
      input.validationStatus === "repaired" ? "fail" :
        input.validationStatus === "not_required" || !input.validationStatus ? "not_required" :
          input.validationStatus === "unavailable" ? "unavailable" : "fail"
  );
  const inferredValidationPath = input.validationPath ?? (
    input.validationStatus === "repaired" ? "repair" : "standard"
  );
  const inferredFinalStatus = input.finalDeterministicStatus ?? (
    input.outcome === "success" ? "pass" : input.outcome === "retry_prompt" ? "fail" : null
  );
  const data = {
    hospitalId: staff.hospitalId,
    staffId: staff.id,
    patientLanguage: input.patientLanguage,
    direction: input.direction,
    transport: input.transport,
    outcome: input.outcome,
    resultReadyMs: optionalMilliseconds(input.resultReadyMs, 120_000),
    audioStartedMs: optionalMilliseconds(input.audioStartedMs, 120_000),
    validationMs: optionalMilliseconds(input.validationMs, 15_000),
    validationStatus: input.validationStatus ?? null,
    corrected: Boolean(input.corrected),
    verifiedSentence: Boolean(input.verifiedSentence),
    errorCategory: input.errorCategory?.trim() || null,
    appVersion: input.appVersion?.trim() || null,
    messageId: input.messageId?.trim() || null,
    packVersion: input.packVersion?.trim() || null,
    glossaryVersion: input.glossaryVersion?.trim() || null,
    normalizationVersion: input.normalizationVersion ?? null,
    modelId: input.modelId?.trim() || null,
    enginePath: input.enginePath ?? (input.transport === "realtime" ? "realtime" : input.transport === "upload" ? "upload_fallback" : null),
    turnEndMode: input.turnEndMode ?? null,
    speechEndToTranscriptMs: optionalMilliseconds(input.speechEndToTranscriptMs, 120_000),
    requestRoundTripMs: optionalMilliseconds(input.requestRoundTripMs, 120_000),
    exactMatchMs: optionalMilliseconds(input.exactMatchMs, 30_000),
    glossaryMatchMs: optionalMilliseconds(input.glossaryMatchMs, 30_000),
    translationMs: optionalMilliseconds(input.translationMs, 120_000),
    correctionMs: optionalMilliseconds(input.correctionMs, 30_000),
    totalMs: optionalMilliseconds(input.totalMs ?? input.resultReadyMs, 120_000),
    initialDeterministicStatus: input.initialDeterministicStatus ?? (input.corrected ? "fail" : inferredFinalStatus),
    finalDeterministicStatus: inferredFinalStatus,
    semanticStatus: inferredSemanticStatus,
    validationPath: inferredValidationPath,
    riskLevel: input.riskLevel ?? null,
    riskReasons: input.riskReasons?.slice(0, 20) ?? [],
    matchedEntryIds: input.matchedEntryIds?.slice(0, 100) ?? [],
    modelAttemptCount: Math.max(0, input.modelAttemptCount ?? 0),
    validationAttemptCount: Math.max(0, input.validationAttemptCount ?? 0),
    correctionAttemptCount: Math.max(0, input.correctionAttemptCount ?? 0),
    strictAttemptCount: Math.max(0, input.strictAttemptCount ?? 0),
    retryRequiredCount: Math.max(0, input.retryRequiredCount ?? (input.outcome === "retry_prompt" ? 1 : 0)),
    estimatedCostUsd: input.estimatedCostUsd ?? null
  };

  return prisma.localInterpreterTurnMetric.upsert({
    where: { id: input.eventId },
    create: { id: input.eventId, ...data },
    update: data,
    select: { id: true }
  });
}

export async function recordServerTranslationQualityMetric(input: {
  eventId: string;
  hospitalId: string;
  staffId: string;
  patientLanguage: PatientLanguage;
  direction: "ko_to_patient" | "patient_to_ko";
  outcome: "success" | "retry_prompt" | "error";
  messageId: string;
  transport: "realtime" | "upload";
  totalMs: number;
  translationMs?: number;
  packVersion?: string;
  glossaryVersion?: string;
  normalizationVersion?: number;
  modelId?: string;
  enginePath: "realtime" | "upload_fallback" | "strict";
  initialDeterministicStatus: "pass" | "fail";
  finalDeterministicStatus: "pass" | "fail";
  semanticStatus: "pass" | "fail" | "not_required" | "unavailable";
  validationPath: "standard" | "repair" | "strict";
  validationMs: number;
  correctionMs: number;
  corrected: boolean;
  verifiedSentence: boolean;
  riskLevel: "normal" | "high";
  riskReasons: string[];
  matchedEntryIds: string[];
  modelAttemptCount: number;
  validationAttemptCount: number;
  correctionAttemptCount: number;
  strictAttemptCount: number;
  errorCategory?: string;
}) {
  const data = {
    hospitalId: input.hospitalId,
    staffId: input.staffId,
    patientLanguage: input.patientLanguage,
    direction: input.direction,
    transport: input.transport,
    outcome: input.outcome,
    resultReadyMs: optionalMilliseconds(input.totalMs, 120_000),
    validationMs: optionalMilliseconds(input.validationMs, 15_000),
    validationStatus: input.semanticStatus === "pass" ? "passed" : input.semanticStatus,
    corrected: input.corrected,
    verifiedSentence: input.verifiedSentence,
    errorCategory: input.errorCategory ?? null,
    appVersion: "web-0.3.39",
    messageId: input.messageId,
    packVersion: input.packVersion ?? null,
    glossaryVersion: input.glossaryVersion ?? null,
    normalizationVersion: input.normalizationVersion ?? null,
    modelId: input.modelId ?? null,
    enginePath: input.enginePath,
    translationMs: optionalMilliseconds(input.translationMs, 120_000),
    correctionMs: optionalMilliseconds(input.correctionMs, 30_000),
    totalMs: optionalMilliseconds(input.totalMs, 120_000),
    initialDeterministicStatus: input.initialDeterministicStatus,
    finalDeterministicStatus: input.finalDeterministicStatus,
    semanticStatus: input.semanticStatus,
    validationPath: input.validationPath,
    riskLevel: input.riskLevel,
    riskReasons: input.riskReasons.slice(0, 20),
    matchedEntryIds: input.matchedEntryIds.slice(0, 100),
    modelAttemptCount: Math.max(0, input.modelAttemptCount),
    validationAttemptCount: Math.max(0, input.validationAttemptCount),
    correctionAttemptCount: Math.max(0, input.correctionAttemptCount),
    strictAttemptCount: Math.max(0, input.strictAttemptCount),
    retryRequiredCount: input.outcome === "retry_prompt" ? 1 : 0
  };

  return prisma.localInterpreterTurnMetric.upsert({
    where: { id: input.eventId },
    create: { id: input.eventId, ...data },
    update: data,
    select: { id: true }
  });
}
