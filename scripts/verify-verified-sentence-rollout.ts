import type { Prisma } from "@prisma/client";
import { clearGlossaryCache, getGlossaryForHospital } from "../src/lib/glossary-service";
import { patientLanguages } from "../src/lib/languages";
import { prisma } from "../src/lib/prisma";

function translationObject(value: Prisma.JsonValue) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

async function main() {
  const rows = await prisma.glossaryEntry.findMany({
    where: { entryType: "verified_sentence", isActive: true },
    select: {
      standardKo: true,
      scope: true,
      specialty: true,
      translations: true
    }
  });

  const missingTranslations = rows.flatMap((row) => {
    const translations = translationObject(row.translations);
    const missingLanguages = patientLanguages.filter((language) => {
      const value = translations[language];
      return typeof value !== "string" || !value.trim();
    });
    return missingLanguages.length > 0 ? [{ standardKo: row.standardKo, missingLanguages }] : [];
  });

  const [dermatologyHospital, plasticSurgeryHospital] = await Promise.all([
    prisma.hospital.findFirst({ where: { specialty: "dermatology" }, select: { id: true } }),
    prisma.hospital.findFirst({ where: { specialty: "plastic_surgery" }, select: { id: true } })
  ]);

  process.env.GLOSSARY_SOURCE = "db";
  clearGlossaryCache();
  const [dermatologyData, plasticSurgeryData] = await Promise.all([
    getGlossaryForHospital(dermatologyHospital?.id ?? null, "dermatology"),
    getGlossaryForHospital(plasticSurgeryHospital?.id ?? null, "plastic_surgery")
  ]);

  const summary = {
    activeVerifiedSentences: rows.length,
    globalRows: rows.filter((row) => row.scope === "global" && row.specialty === null).length,
    specialtyRows: rows.filter((row) => row.scope === "specialty").length,
    missingTranslations,
    dermatologyVisible: dermatologyData.verifiedSentences.length,
    plasticSurgeryVisible: plasticSurgeryData.verifiedSentences.length
  };

  console.log(JSON.stringify(summary, null, 2));

  if (
    summary.activeVerifiedSentences !== 36 ||
    summary.globalRows !== 36 ||
    summary.specialtyRows !== 0 ||
    summary.missingTranslations.length > 0 ||
    summary.dermatologyVisible !== 36 ||
    summary.plasticSurgeryVisible !== 36
  ) {
    throw new Error("Verified sentence rollout validation failed.");
  }
}

main()
  .finally(async () => {
    await prisma.$disconnect();
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
