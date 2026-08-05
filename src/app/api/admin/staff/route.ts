import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentStaff } from "@/lib/session";
import { hospitalSpecialties } from "@/lib/hospital-specialty";

const schema = z.object({
  hospitalName: z.string().trim().min(1).max(80),
  hospitalSlug: z
    .string()
    .trim()
    .min(2)
    .max(48)
    .regex(/^[a-z0-9-]+$/),
  hospitalSpecialty: z.enum(hospitalSpecialties).optional().default("dermatology"),
  name: z.string().trim().min(1).max(80),
  email: z.string().trim().email().max(160),
  password: z.string().min(6).max(128).optional().or(z.literal("")),
  role: z.enum(["staff", "hospital_admin"]).default("staff")
});

const updateSchema = z.object({
  staffUserId: z.string().min(1),
  hospitalName: z.string().trim().min(1).max(80),
  hospitalSlug: z
    .string()
    .trim()
    .min(2)
    .max(48)
    .regex(/^[a-z0-9-]+$/),
  hospitalSpecialty: z.enum(hospitalSpecialties).optional(),
  name: z.string().trim().min(1).max(80),
  email: z.string().trim().email().max(160),
  password: z.string().min(6).max(128).optional().or(z.literal("")),
  generatePassword: z.boolean().optional(),
  role: z.enum(["staff", "hospital_admin", "internal_admin"]),
  isActive: z.boolean()
});

const deleteSchema = z.object({
  staffUserId: z.string().min(1)
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
      select: { id: true, name: true, slug: true, status: true, specialty: true, planType: true }
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
        hospital: { select: { name: true, slug: true, specialty: true } }
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
        specialty: parsed.data.hospitalSpecialty,
        status: "active"
      },
      create: {
        name: parsed.data.hospitalName,
        slug: parsed.data.hospitalSlug,
        specialty: parsed.data.hospitalSpecialty,
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
        sessionVersion: { increment: 1 },
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
        hospital: { select: { name: true, slug: true, specialty: true } }
      }
    });

    return staffUser;
  });

  return NextResponse.json({
    staffUser: result,
    temporaryPassword: parsed.data.password ? null : password
  });
}

export async function PATCH(request: Request) {
  const admin = await requireInternalAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = updateSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid staff update payload" }, { status: 400 });
  }

  const email = parsed.data.email.toLowerCase();
  const nextPassword = parsed.data.generatePassword ? generatePassword() : parsed.data.password || null;
  const passwordHash = nextPassword ? await bcrypt.hash(nextPassword, 10) : null;

  try {
    const result = await prisma.$transaction(async (tx) => {
      const hospital = await tx.hospital.upsert({
        where: { slug: parsed.data.hospitalSlug },
        update: {
          name: parsed.data.hospitalName,
          ...(parsed.data.hospitalSpecialty ? { specialty: parsed.data.hospitalSpecialty } : {}),
          status: "active"
        },
        create: {
          name: parsed.data.hospitalName,
          slug: parsed.data.hospitalSlug,
          specialty: parsed.data.hospitalSpecialty ?? "dermatology",
          planType: "partner_free",
          status: "active"
        }
      });

      return tx.staffUser.update({
        where: { id: parsed.data.staffUserId },
        data: {
          hospitalId: hospital.id,
          name: parsed.data.name,
          email,
          role: parsed.data.role,
          isActive: parsed.data.isActive,
          ...(passwordHash ? { passwordHash, sessionVersion: { increment: 1 } } : {})
        },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          isActive: true,
          lastLoginAt: true,
          hospital: { select: { name: true, slug: true, specialty: true } }
        }
      });
    });

    return NextResponse.json({
      staffUser: result,
      temporaryPassword: parsed.data.generatePassword ? nextPassword : null
    });
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : "Staff update failed";
    if (message.includes("Unique constraint failed")) {
      return NextResponse.json({ error: "Email already exists" }, { status: 409 });
    }
    throw caught;
  }
}

export async function DELETE(request: Request) {
  const admin = await requireInternalAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = deleteSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid staff delete payload" }, { status: 400 });
  }

  if (parsed.data.staffUserId === admin.id) {
    return NextResponse.json({ error: "Cannot delete the current admin account" }, { status: 400 });
  }

  const [roomCount, usageCount, localUsageCount, textUsageCount, localMetricCount] = await Promise.all([
    prisma.translationRoom.count({ where: { hostStaffId: parsed.data.staffUserId } }),
    prisma.usageSession.count({ where: { staffId: parsed.data.staffUserId } }),
    prisma.localInterpreterUsageTurn.count({ where: { staffId: parsed.data.staffUserId } }),
    prisma.textTranslationUsage.count({ where: { staffId: parsed.data.staffUserId } }),
    prisma.localInterpreterTurnMetric.count({ where: { staffId: parsed.data.staffUserId } })
  ]);

  if (roomCount > 0 || usageCount > 0 || localUsageCount > 0 || textUsageCount > 0 || localMetricCount > 0) {
    const staffUser = await prisma.staffUser.update({
      where: { id: parsed.data.staffUserId },
      data: { isActive: false },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        lastLoginAt: true,
        hospital: { select: { name: true, slug: true, specialty: true } }
      }
    });

    return NextResponse.json({ deleted: false, deactivated: true, staffUser });
  }

  await prisma.staffUser.delete({ where: { id: parsed.data.staffUserId } });
  return NextResponse.json({ deleted: true, deactivated: false });
}
