import { PrismaClient } from "@prisma/client";
import { inferHospitalSpecialtyFromName } from "../src/lib/hospital-specialty";

const prisma = new PrismaClient();

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const hospitals = await prisma.hospital.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, slug: true, specialty: true }
  });

  let changed = 0;
  for (const hospital of hospitals) {
    const specialty = inferHospitalSpecialtyFromName(hospital.name);
    const label = `${hospital.name} (${hospital.slug})`;

    if (hospital.specialty === specialty) {
      console.log(`[keep] ${label}: ${specialty}`);
      continue;
    }

    changed += 1;
    console.log(`[update] ${label}: ${hospital.specialty} -> ${specialty}`);
    if (!dryRun) {
      await prisma.hospital.update({
        where: { id: hospital.id },
        data: { specialty }
      });
    }
  }

  console.log(`${dryRun ? "Dry run" : "Backfill"} complete. ${changed}/${hospitals.length} hospital(s) would change.`);
}

main()
  .finally(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    process.exit(1);
  });
