import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { setStaffSession } from "@/lib/session";
import { clientIp, rateLimit, rateLimitResponse } from "@/lib/rate-limit";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  remember: z.boolean().optional()
});

const dummyPasswordHash = bcrypt.hashSync("clinic-voice-room-dummy-password", 10);

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid login payload" }, { status: 400 });
  }

  const ip = clientIp(request);
  const emailKey = parsed.data.email.trim().toLowerCase();
  const limited = await rateLimit({ key: `login:${ip}:${emailKey}`, limit: 8, windowMs: 10 * 60 * 1000 });
  if (!limited.ok) {
    return rateLimitResponse(limited.retryAfter);
  }

  const staff = await prisma.staffUser.findUnique({
    where: { email: emailKey },
    include: { hospital: true }
  });

  const ok = await bcrypt.compare(parsed.data.password, staff?.passwordHash ?? dummyPasswordHash);
  if (!staff || !staff.isActive || staff.hospital.status !== "active" || !ok) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  await prisma.staffUser.update({
    where: { id: staff.id },
    data: { lastLoginAt: new Date() }
  });
  await setStaffSession(staff.id, { remember: parsed.data.remember ?? false });

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
