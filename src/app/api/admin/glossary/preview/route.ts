import { createHash } from "crypto";
import { NextResponse } from "next/server";
import { buildClinicTranscriptionPromptDetails } from "@/lib/clinic-glossary";
import { getGlossaryForHospital, glossarySource } from "@/lib/glossary-service";
import { prisma } from "@/lib/prisma";
import { getCurrentStaff } from "@/lib/session";

export async function GET(request: Request) {
  const admin = await getCurrentStaff();
  if (!admin || admin.role === "staff") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const requestedHospitalId = new URL(request.url).searchParams.get("hospitalId");
  const hospitalId = admin.role === "hospital_admin" ? admin.hospitalId : requestedHospitalId;
  const hospital = hospitalId
    ? await prisma.hospital.findUnique({
        where: { id: hospitalId },
        select: { id: true, name: true, slug: true, specialty: true }
      })
    : await prisma.hospital.findFirst({
        orderBy: { name: "asc" },
        select: { id: true, name: true, slug: true, specialty: true }
      });

  if (!hospital) {
    return NextResponse.json({ error: "Hospital not found" }, { status: 404 });
  }

  const glossaryData = await getGlossaryForHospital(hospital.id, hospital.specialty);
  const details = buildClinicTranscriptionPromptDetails(
    glossaryData.transcriptionHints,
    glossaryData.transcriptionHintMappings
  );

  return NextResponse.json(
    {
      hospital,
      source: glossarySource(),
      prompt: details.prompt,
      promptHash: createHash("sha256").update(details.prompt).digest("hex").slice(0, 12),
      chars: details.chars,
      hintCount: details.hintCount,
      mappingCount: details.mappingCount,
      omittedHintCount: details.omittedHintCount,
      omittedMappingCount: details.omittedMappingCount,
      omittedHints: details.omittedHints,
      omittedMappingStandardForms: details.omittedMappingStandardForms,
      truncated: details.truncated,
      conflicts: details.conflicts
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
