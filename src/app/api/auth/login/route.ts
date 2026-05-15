import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { setStaffSession } from "@/lib/session";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid login payload" }, { status: 400 });
  }

  const staff = await prisma.staffUser.findUnique({
    where: { email: parsed.data.email },
    include: { hospital: true }
  });

  if (!staff || !staff.isActive || staff.hospital.status !== "active") {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  const ok = await bcrypt.compare(parsed.data.password, staff.passwordHash);
  if (!ok) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  await prisma.staffUser.update({
    where: { id: staff.id },
    data: { lastLoginAt: new Date() }
  });
  await setStaffSession(staff.id);

  return NextResponse.json({
    staff: {
      id: staff.id,
      name: staff.name,
      email: staff.email,
      role: staff.role,
      hospital: staff.hospital
    }
  });
}
