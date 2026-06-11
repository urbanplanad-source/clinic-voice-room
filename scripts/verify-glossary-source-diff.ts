import type { HospitalSpecialty, PatientLanguage } from "@prisma/client";
import { buildClinicGlossaryInstructions } from "../src/lib/clinic-glossary";
import { clearGlossaryCache, getCodeGlossaryData, getGlossaryForHospital } from "../src/lib/glossary-service";
import { prisma } from "../src/lib/prisma";

function readArg(name: string) {
  const index = process.argv.indexOf(name);
  if (index === -1) return undefined;
  return process.argv[index + 1];
}

function normalizeInstructions(value: string) {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .sort()
    .join("\n");
}

function diffLines(left: string, right: string) {
  const leftLines = new Set(left.split("\n"));
  const rightLines = new Set(right.split("\n"));
  return {
    onlyCode: Array.from(leftLines).filter((line) => !rightLines.has(line)).slice(0, 20),
    onlyDb: Array.from(rightLines).filter((line) => !leftLines.has(line)).slice(0, 20)
  };
}

async function main() {
  const hospitalId = readArg("--hospital-id") ?? null;
  const specialtyArg = readArg("--specialty");
  const specialty = specialtyArg ? (specialtyArg as HospitalSpecialty) : null;
  const languages = ((readArg("--languages") ?? "zh,ja,en,ru,vi,id").split(",").map((value) => value.trim()).filter(Boolean)) as PatientLanguage[];

  const activeRows = await prisma.glossaryEntry.count({ where: { isActive: true } });
  if (activeRows === 0) {
    throw new Error("No active GlossaryEntry rows found. Run prisma migrations and glossary:import first.");
  }

  clearGlossaryCache();
  const codeData = getCodeGlossaryData();
  process.env.GLOSSARY_SOURCE = "db";
  const dbData = await getGlossaryForHospital(hospitalId, specialty);

  for (const language of languages) {
    const codeInstructions = normalizeInstructions(buildClinicGlossaryInstructions(language, codeData));
    const dbInstructions = normalizeInstructions(buildClinicGlossaryInstructions(language, dbData));
    if (codeInstructions !== dbInstructions) {
      const diff = diffLines(codeInstructions, dbInstructions);
      console.error(`Glossary instruction diff detected for ${language}.`);
      console.error("Only in code:", diff.onlyCode);
      console.error("Only in db:", diff.onlyDb);
      process.exit(1);
    }
  }

  console.log(`Glossary source diff check passed for ${languages.join(", ")}.`);
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
