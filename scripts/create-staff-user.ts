import { PrismaClient, type StaffRole } from "@prisma/client";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";

const prisma = new PrismaClient();

function readArg(name: string) {
  const index = process.argv.indexOf(name);
  if (index === -1) return undefined;
  return process.argv[index + 1];
}

function requiredArg(name: string) {
  const value = readArg(name);
  if (!value) {
    throw new Error(`Missing required argument: ${name}`);
  }
  return value;
}

function generatePassword() {
  return `Clinic-${randomBytes(4).toString("hex")}-${randomBytes(3).toString("hex")}!`;
}

function parseRole(value: string): StaffRole {
  if (value === "staff" || value === "hospital_admin" || value === "internal_admin") return value;
  throw new Error("--role must be staff, hospital_admin, or internal_admin");
}

async function main() {
  const hospitalSlug = readArg("--hospital-slug") ?? "bellemon";
  const hospitalName = readArg("--hospital-name") ?? "벨르몬성형외과";
  const name = requiredArg("--name");
  const email = requiredArg("--email").trim().toLowerCase();
  const password = readArg("--password") ?? process.env.STAFF_PASSWORD ?? generatePassword();
  const role = parseRole(readArg("--role") ?? "staff");

  const hospital = await prisma.hospital.upsert({
    where: { slug: hospitalSlug },
    update: {
      name: hospitalName,
      status: "active"
    },
    create: {
      name: hospitalName,
      slug: hospitalSlug,
      planType: "partner_free",
      status: "active"
    }
  });

  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.staffUser.upsert({
    where: { email },
    update: {
      hospitalId: hospital.id,
      name,
      passwordHash,
      sessionVersion: { increment: 1 },
      role,
      isActive: true
    },
    create: {
      hospitalId: hospital.id,
      name,
      email,
      passwordHash,
      role
    }
  });

  console.log(`Created or updated staff user for ${hospitalName}`);
  console.log(`Name: ${name}`);
  console.log(`Email: ${email}`);
  console.log(`Role: ${role}`);
  if (!readArg("--password") && !process.env.STAFF_PASSWORD) {
    console.log(`Generated password: ${password}`);
  }
}

main()
  .finally(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    process.exit(1);
  });
