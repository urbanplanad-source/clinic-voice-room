import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("password1234", 10);

  const hospital = await prisma.hospital.upsert({
    where: { slug: "urban-clinic" },
    update: { name: "BTSKIN CLINIC" },
    create: {
      name: "BTSKIN CLINIC",
      slug: "urban-clinic",
      planType: "partner_free",
      status: "active"
    }
  });

  await prisma.staffUser.upsert({
    where: { email: "staff@clinic.test" },
    update: { passwordHash, hospitalId: hospital.id, name: "상담실장" },
    create: {
      hospitalId: hospital.id,
      name: "상담실장",
      email: "staff@clinic.test",
      passwordHash,
      role: "staff"
    }
  });

  await prisma.staffUser.upsert({
    where: { email: "admin@clinic.test" },
    update: { passwordHash, hospitalId: hospital.id },
    create: {
      hospitalId: hospital.id,
      name: "Internal Admin",
      email: "admin@clinic.test",
      passwordHash,
      role: "internal_admin"
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
