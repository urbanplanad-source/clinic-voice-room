import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentStaff } from "@/lib/session";
import { clientIp, rateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { isPatientLanguage, type PatientLanguage } from "@/lib/languages";
import {
  medivoiceHybridPolicy,
  medivoiceHybridTargetLanguage
} from "@/lib/medivoice-hybrid-translation";
import {
  createRealtimeTranslationClientSecret,
  RealtimeTranslationSessionError
} from "@/lib/openai-realtime-translation";

const schema = z.object({
  patientLanguage: z.custom<PatientLanguage>((value) => isPatientLanguage(value)),
  direction: z.enum(["ko_to_patient", "patient_to_ko"])
});

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid translation session request" }, { status: 400 });
  }

  const staff = await getCurrentStaff();
  if (!staff) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const policy = medivoiceHybridPolicy(parsed.data.patientLanguage);
  if (!policy.enabled) {
    return NextResponse.json({ policy, token: null });
  }

  const limited = await rateLimit({
    key: `local-translation-session:${clientIp(request)}:${staff.id}:${parsed.data.patientLanguage}:${parsed.data.direction}`,
    limit: 40,
    windowMs: 60 * 1000
  });
  if (!limited.ok) {
    return rateLimitResponse(limited.retryAfter);
  }

  try {
    const token = await createRealtimeTranslationClientSecret({
      targetLanguage: medivoiceHybridTargetLanguage(parsed.data.patientLanguage, parsed.data.direction),
      safetyIdentifier: `${staff.hospitalId}:${staff.id}:clinic-local:${parsed.data.patientLanguage}:${parsed.data.direction}`,
      safetyScope: "clinic-local"
    });
    return NextResponse.json({ policy, token });
  } catch (caught) {
    const status = caught instanceof RealtimeTranslationSessionError
      ? caught.status >= 500 && caught.status < 600
        ? caught.status
        : 502
      : 502;
    const message = caught instanceof Error ? caught.message : "Realtime translation session request failed";
    console.error("[realtime/local-translation-session-token]", message);
    return NextResponse.json(
      { error: "Realtime translation session could not be created", policy },
      { status }
    );
  }
}
