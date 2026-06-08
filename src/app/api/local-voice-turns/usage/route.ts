import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentStaff } from "@/lib/session";
import { clientIp, rateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { isPatientLanguage, type PatientLanguage } from "@/lib/languages";
import {
  recordLocalInterpreterUsageTurn,
  type LocalInterpreterDirection,
  type LocalInterpreterTransport
} from "@/lib/local-interpreter-usage";

const schema = z.object({
  patientLanguage: z.custom<PatientLanguage>((value) => isPatientLanguage(value)),
  direction: z.enum(["ko_to_patient", "patient_to_ko"]),
  transport: z.enum(["realtime", "upload"]).default("realtime"),
  durationSeconds: z.number().min(0).max(60 * 30).default(0),
  sourceTextCharacters: z.number().min(0).max(100_000).optional(),
  translatedTextCharacters: z.number().min(0).max(100_000).optional()
});

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid local usage event" }, { status: 400 });
  }

  const staff = await getCurrentStaff();
  if (!staff) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limited = await rateLimit({
    key: `local-usage:${clientIp(request)}:${staff.id}:${parsed.data.patientLanguage}:${parsed.data.direction}`,
    limit: 60,
    windowMs: 60 * 1000
  });
  if (!limited.ok) {
    return rateLimitResponse(limited.retryAfter);
  }

  await recordLocalInterpreterUsageTurn({
    staff,
    patientLanguage: parsed.data.patientLanguage,
    direction: parsed.data.direction as LocalInterpreterDirection,
    transport: parsed.data.transport as LocalInterpreterTransport,
    durationSeconds: parsed.data.durationSeconds,
    sourceTextCharacters: parsed.data.sourceTextCharacters,
    translatedTextCharacters: parsed.data.translatedTextCharacters
  });

  return NextResponse.json({ ok: true });
}
