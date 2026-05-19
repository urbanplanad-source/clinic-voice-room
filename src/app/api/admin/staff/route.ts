import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentStaff } from "@/lib/session";

const schema = z.object({
  hospitalName: z.string().trim().min(1).max(80),
  hospitalSlug: z
    .string()
    .trim()
    .min(2)
    .max(48)
    .regex(/^[a-z0-9-]+$/),
  name: z.string().trim().min(1).max(80),
  email: z.string().trim().email().max(160),
  password: z.string().min(10).max(128).optional().or(z.literal("")),
  role: z.enum(["staff", "hospital_admin"]).default("staff")
});

function generatePassword() {
  return `Clinic-${randomBytes(4).toString("hex")}-${randomBytes(3).toString("hex")}!`;
}

async function requireInternalAdmin() {
  const staff = await getCurrentStaff();
  return staff?.role === "internal_admin" ? staff : null;
}

export async function GET() {
  const admin = await requireInternalAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [hospitals, staffUsers] = await Promise.all([
    prisma.hospital.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, slug: true, status: true, planType: true }
    }),
    prisma.staffUser.findMany({
      orderBy: [{ hospital: { name: "asc" } }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        lastLoginAt: true,
        hospital: { select: { name: true, slug: true } }
      }
    })
  ]);

  return NextResponse.json({ hospitals, staffUsers });
}

export async function POST(request: Request) {
  const admin = await requireInternalAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid staff payload" }, { status: 400 });
  }

  const password = parsed.data.password || generatePassword();
  const passwordHash = await bcrypt.hash(password, 10);
  const email = parsed.data.email.toLowerCase();

  const result = await prisma.$transaction(async (tx) => {
    const hospital = await tx.hospital.upsert({
      where: { slug: parsed.data.hospitalSlug },
      update: {
        name: parsed.data.hospitalName,
        status: "active"
      },
      create: {
        name: parsed.data.hospitalName,
        slug: parsed.data.hospitalSlug,
        planType: "partner_free",
        status: "active"
      }
    });

    const staffUser = await tx.staffUser.upsert({
      where: { email },
      update: {
        hospitalId: hospital.id,
        name: parsed.data.name,
        passwordHash,
        role: parsed.data.role,
        isActive: true
      },
      create: {
        hospitalId: hospital.id,
        name: parsed.data.name,
        email,
        passwordHash,
        role: parsed.data.role
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        hospital: { select: { name: true, slug: true } }
      }
    });

    return staffUser;
  });

  return NextResponse.json({
    staffUser: result,
    temporaryPassword: parsed.data.password ? null : password
  });
}
