import { NextResponse } from "next/server";
import { z } from "zod";
import { isPatientLanguage, type PatientLanguage } from "@/lib/languages";
import { recordLocalInterpreterTurnMetric } from "@/lib/local-interpreter-metrics";
import { clientIp, rateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { getCurrentStaff } from "@/lib/session";

const schema = z.object({
  eventId: z.string().uuid(),
  patientLanguage: z.custom<PatientLanguage>((value) => isPatientLanguage(value)),
  direction: z.enum(["ko_to_patient", "patient_to_ko"]),
  transport: z.enum(["realtime", "upload", "unknown"]),
  outcome: z.enum(["success", "retry_prompt", "error"]),
  resultReadyMs: z.number().int().min(0).max(120_000).optional(),
  audioStartedMs: z.number().int().min(0).max(120_000).optional(),
  validationMs: z.number().int().min(0).max(15_000).optional(),
  validationStatus: z.enum(["not_required", "passed", "repaired", "unavailable", "unresolved"]).optional(),
  corrected: z.boolean().optional().default(false),
  verifiedSentence: z.boolean().optional().default(false),
  errorCategory: z.string().trim().max(80).optional(),
  appVersion: z.string().trim().max(32).optional(),
  messageId: z.string().trim().max(120).optional(),
  packVersion: z.string().trim().max(80).optional(),
  glossaryVersion: z.string().trim().max(80).optional(),
  normalizationVersion: z.number().int().min(1).max(1000).optional(),
  modelId: z.string().trim().max(120).optional(),
  enginePath: z.enum(["realtime", "upload_fallback", "strict"]).optional(),
  turnEndMode: z.enum(["manual", "silence", "unknown"]).optional(),
  speechEndToTranscriptMs: z.number().int().min(0).max(120_000).optional(),
  requestRoundTripMs: z.number().int().min(0).max(120_000).optional(),
  exactMatchMs: z.number().int().min(0).max(30_000).optional(),
  glossaryMatchMs: z.number().int().min(0).max(30_000).optional(),
  translationMs: z.number().int().min(0).max(120_000).optional(),
  correctionMs: z.number().int().min(0).max(30_000).optional(),
  totalMs: z.number().int().min(0).max(120_000).optional(),
  initialDeterministicStatus: z.enum(["pass", "fail"]).optional(),
  finalDeterministicStatus: z.enum(["pass", "fail"]).optional(),
  semanticStatus: z.enum(["pass", "fail", "not_required", "unavailable"]).optional(),
  validationPath: z.enum(["standard", "repair", "strict"]).optional(),
  riskLevel: z.enum(["normal", "high"]).optional(),
  riskReasons: z.array(z.string().trim().max(80)).max(20).optional(),
  matchedEntryIds: z.array(z.string().trim().max(120)).max(100).optional(),
  modelAttemptCount: z.number().int().min(0).max(20).optional(),
  validationAttemptCount: z.number().int().min(0).max(20).optional(),
  correctionAttemptCount: z.number().int().min(0).max(20).optional(),
  strictAttemptCount: z.number().int().min(0).max(20).optional(),
  retryRequiredCount: z.number().int().min(0).max(20).optional(),
  estimatedCostUsd: z.number().min(0).max(100).optional()
}).strict();

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid local metric event" }, { status: 400 });
  }

  const staff = await getCurrentStaff();
  if (!staff) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limited = await rateLimit({
    key: `local-metric:${clientIp(request)}:${staff.id}`,
    limit: 120,
    windowMs: 60 * 1000
  });
  if (!limited.ok) {
    return rateLimitResponse(limited.retryAfter);
  }

  try {
    await recordLocalInterpreterTurnMetric(staff, parsed.data);
  } catch (caught) {
    if (caught instanceof Error && caught.message.includes("another staff account")) {
      return NextResponse.json({ error: "Metric event conflict" }, { status: 409 });
    }
    throw caught;
  }

  return NextResponse.json({ ok: true });
}
