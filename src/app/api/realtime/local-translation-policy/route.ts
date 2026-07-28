import { NextResponse } from "next/server";
import { getCurrentStaff } from "@/lib/session";
import { isPatientLanguage } from "@/lib/languages";
import { medivoiceHybridPolicy } from "@/lib/medivoice-hybrid-translation";

export async function GET(request: Request) {
  const staff = await getCurrentStaff();
  if (!staff) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const patientLanguage = new URL(request.url).searchParams.get("patientLanguage");
  if (!isPatientLanguage(patientLanguage)) {
    return NextResponse.json({ error: "Invalid patient language" }, { status: 400 });
  }

  return NextResponse.json({ policy: medivoiceHybridPolicy(patientLanguage) });
}
