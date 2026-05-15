import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { getCurrentStaff } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { isPatientLanguage } from "@/lib/languages";

const schema = z.object({
  patientLanguage: z.string().refine(isPatientLanguage)
});

export async function POST(request: Request) {
  const staff = await getCurrentStaff();
  if (!staff) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Unsupported patient language" }, { status: 400 });
  }

  const roomToken = randomBytes(24).toString("base64url");

  const room = await prisma.translationRoom.create({
    data: {
      hospitalId: staff.hospitalId,
      hostStaffId: staff.id,
      patientLanguage: parsed.data.patientLanguage,
      roomToken,
      status: "waiting_for_patient",
      participants: {
        create: {
          role: "staff",
          connectionState: "connected"
        }
      },
      usageSession: {
        create: {
          hospitalId: staff.hospitalId,
          staffId: staff.id,
          patientLanguage: parsed.data.patientLanguage,
          roomStartedAt: new Date()
        }
      }
    },
    include: { hospital: true, hostStaff: true, usageSession: true }
  });

  return NextResponse.json({ room });
}
