import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentStaff } from "@/lib/session";
import { createRealtimeSessionToken } from "@/lib/openai-realtime";
import { clientIp, rateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { getGlossaryForHospital } from "@/lib/glossary-service";
import { isPatientLanguage, type ParticipantRole, type PatientLanguage } from "@/lib/languages";

const schema = z.object({
  patientLanguage: z.custom<PatientLanguage>((value) => isPatientLanguage(value)),
  direction: z.enum(["ko_to_patient", "patient_to_ko"]),
  manualTurn: z.boolean().optional()
});

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid token request" }, { status: 400 });
  }

  const staff = await getCurrentStaff();
  if (!staff) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limited = await rateLimit({
    key: `local-realtime-token:${clientIp(request)}:${staff.id}:${parsed.data.patientLanguage}:${parsed.data.direction}`,
    limit: 40,
    windowMs: 60 * 1000
  });
  if (!limited.ok) {
    return rateLimitResponse(limited.retryAfter);
  }

  const role: ParticipantRole = parsed.data.direction === "ko_to_patient" ? "staff" : "patient";
  const realtimeDirection = parsed.data.direction === "ko_to_patient" ? "staff_to_patient" : "patient_to_staff";

  let token;
  try {
    const glossaryData = await getGlossaryForHospital(staff.hospitalId, staff.hospital.specialty);
    token = await createRealtimeSessionToken({
      role,
      patientLanguage: parsed.data.patientLanguage,
      direction: realtimeDirection,
      manualTurn: parsed.data.manualTurn,
      glossaryData,
      safetyIdentifier: `${staff.hospitalId}:${staff.id}:local:${parsed.data.patientLanguage}:${parsed.data.direction}`
    });
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : "Realtime translation token request failed";
    console.error("[realtime/local-session-token]", message);
    return NextResponse.json({ error: "Realtime translation session token could not be created" }, { status: 502 });
  }

  return NextResponse.json({ token });
}
