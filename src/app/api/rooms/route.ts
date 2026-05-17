import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { getCurrentStaff } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { isPatientLanguage } from "@/lib/languages";
import { getHospitalActiveRoomLimit } from "@/lib/room-limits";
import { endStaleRooms } from "@/lib/stale-rooms";

const schema = z.object({
  patientLanguage: z.string().refine(isPatientLanguage)
});

class ActiveRoomLimitError extends Error {
  constructor(
    readonly activeRoomCount: number,
    readonly activeRoomLimit: number
  ) {
    super("Hospital active room limit reached.");
  }
}

export async function POST(request: Request) {
  const staff = await getCurrentStaff();
  if (!staff) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Unsupported patient language" }, { status: 400 });
  }

  await endStaleRooms({ hospitalId: staff.hospitalId });

  const activeRoomLimit = getHospitalActiveRoomLimit();
  let room;
  try {
    room = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${staff.hospitalId})::bigint)`;

      const activeRoomCount = await tx.translationRoom.count({
        where: {
          hospitalId: staff.hospitalId,
          status: { not: "ended" }
        }
      });

      if (activeRoomCount >= activeRoomLimit) {
        throw new ActiveRoomLimitError(activeRoomCount, activeRoomLimit);
      }

      const roomToken = randomBytes(24).toString("base64url");
      return tx.translationRoom.create({
        data: {
          hospitalId: staff.hospitalId,
          patientLanguage: parsed.data.patientLanguage,
          hostStaffId: staff.id,
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
    });
  } catch (caught) {
    if (caught instanceof ActiveRoomLimitError) {
      return NextResponse.json(
        {
          error: "Active room limit reached",
          activeRoomCount: caught.activeRoomCount,
          activeRoomLimit: caught.activeRoomLimit
        },
        { status: 429 }
      );
    }
    throw caught;
  }

  return NextResponse.json({ room });
}
