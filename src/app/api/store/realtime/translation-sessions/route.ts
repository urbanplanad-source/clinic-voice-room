import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentStaff } from "@/lib/session";
import { clientIp, rateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { isPatientLanguage, type PatientLanguage } from "@/lib/languages";
import {
  createRealtimeTranslationClientSecret,
  RealtimeTranslationSessionError
} from "@/lib/openai-realtime-translation";

const schema = z.object({
  patientLanguage: z.custom<PatientLanguage>((value) => isPatientLanguage(value))
});

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid translation session request" }, { status: 400 });
  }

  // This is the secure development gate until the separate store app gets
  // one-time device activation. It deliberately does not expose an anonymous
  // OpenAI client-secret endpoint.
  const staff = await getCurrentStaff();
  if (!staff) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limited = await rateLimit({
    key: `store-translation-session:${clientIp(request)}:${staff.id}:${parsed.data.patientLanguage}`,
    limit: 20,
    windowMs: 60 * 1000
  });
  if (!limited.ok) {
    return rateLimitResponse(limited.retryAfter);
  }

  try {
    const safetyBase = `${staff.hospitalId}:${staff.id}:store:${parsed.data.patientLanguage}`;
    const [staffToCustomer, customerToStaff] = await Promise.all([
      createRealtimeTranslationClientSecret({
        targetLanguage: parsed.data.patientLanguage,
        safetyIdentifier: `${safetyBase}:staff-to-customer`
      }),
      createRealtimeTranslationClientSecret({
        targetLanguage: "ko",
        safetyIdentifier: `${safetyBase}:customer-to-staff`
      })
    ]);

    return NextResponse.json({
      sessions: {
        staffToCustomer,
        customerToStaff
      }
    });
  } catch (caught) {
    const status = caught instanceof RealtimeTranslationSessionError
      ? caught.status >= 500 && caught.status < 600
        ? caught.status
        : 502
      : 502;
    const message = caught instanceof Error ? caught.message : "Realtime translation session request failed";
    console.error("[store/realtime/translation-sessions]", message);
    return NextResponse.json({ error: "Realtime translation sessions could not be created" }, { status });
  }
}
