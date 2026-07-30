import { buildClinicTranscriptionPromptDetails } from "../src/lib/clinic-glossary";
import { clearGlossaryCache, getGlossaryForHospital } from "../src/lib/glossary-service";
import { prisma } from "../src/lib/prisma";

const requiredKoreanPromptTerms = [
  "써마지",
  "서머지",
  "울쎄라",
  "울새나",
  "웃음세라",
  "Re2O",
  "리투오",
  "미주란",
  "켄루이드",
  "울쎄라 핏 프라임",
  "시술에 관심이 있으세요?"
];

function readArg(name: string) {
  const index = process.argv.indexOf(name);
  if (index === -1) return undefined;
  return process.argv[index + 1];
}

async function main() {
  const hospitalId = readArg("--hospital-id");
  const hospitals = await prisma.hospital.findMany({
    where: hospitalId ? { id: hospitalId } : { status: "active" },
    orderBy: { name: "asc" },
    select: { id: true, name: true, specialty: true }
  });
  if (hospitals.length === 0) throw new Error("No matching active hospital was found.");

  process.env.GLOSSARY_SOURCE = "db";
  clearGlossaryCache();
  const summaries = [];

  for (const hospital of hospitals) {
    const glossaryData = await getGlossaryForHospital(hospital.id, hospital.specialty);
    const details = buildClinicTranscriptionPromptDetails(
      glossaryData.transcriptionHints,
      glossaryData.transcriptionHintMappings
    );
    const missingRequiredTerms = requiredKoreanPromptTerms.filter((term) => !details.prompt.includes(term));
    summaries.push({
      hospitalId: hospital.id,
      hospital: hospital.name,
      specialty: hospital.specialty,
      chars: details.chars,
      hintCount: details.hintCount,
      mappingCount: details.mappingCount,
      omittedHintCount: details.omittedHintCount,
      omittedMappingCount: details.omittedMappingCount,
      truncated: details.truncated,
      conflicts: details.conflicts,
      missingRequiredTerms
    });
  }

  console.log(JSON.stringify(summaries, null, 2));
  const failed = summaries.some((summary) => summary.conflicts.length > 0 || summary.missingRequiredTerms.length > 0);
  if (failed) process.exitCode = 1;
}

main()
  .finally(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
