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
  appVersion: z.string().trim().max(32).optional()
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