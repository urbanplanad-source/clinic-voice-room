import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const seedPassword = process.env.SEED_STAFF_PASSWORD;
  if (!seedPassword) {
    console.log("Skipping seed staff users. Set SEED_STAFF_PASSWORD to create local seed accounts.");
    return;
  }

  const passwordHash = await bcrypt.hash(seedPassword, 10);
  const hospitalSlug = process.env.SEED_HOSPITAL_SLUG ?? "bellemon";
  const hospitalName = process.env.SEED_HOSPITAL_NAME ?? "벨르몬성형외과";
  const staffEmail = process.env.SEED_STAFF_EMAIL ?? "bellemon01@clinic.local";
  const staffName = process.env.SEED_STAFF_NAME ?? "상담실장";

  const hospital = await prisma.hospital.upsert({
    where: { slug: hospitalSlug },
    update: { name: hospitalName },
    create: {
      name: hospitalName,
      slug: hospitalSlug,
      planType: "partner_free",
      status: "active"
    }
  });

  await prisma.staffUser.upsert({
    where: { email: staffEmail },
    update: { passwordHash, hospitalId: hospital.id, name: staffName },
    create: {
      hospitalId: hospital.id,
      name: staffName,
      email: staffEmail,
      passwordHash,
      role: "staff"
    }
  });
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
