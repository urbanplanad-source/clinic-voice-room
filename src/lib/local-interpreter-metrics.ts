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
    appVersion: input.appVersion?.trim() || null
  };

  return prisma.localInterpreterTurnMetric.upsert({
    where: { id: input.eventId },
    create: { id: input.eventId, ...data },
    update: data,
    select: { id: true }
  });
}