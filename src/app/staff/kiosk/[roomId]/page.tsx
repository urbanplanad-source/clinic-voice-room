import { redirect } from "next/navigation";
import { DualHardwareKioskRoom } from "@/components/DualHardwareKioskRoom";
import { ensurePatientJoinCode } from "@/lib/patient-join-code";
import { prisma } from "@/lib/prisma";
import { getCurrentStaff } from "@/lib/session";

export default async function StaffKioskRoomPage({
  params
}: {
  params: Promise<{ roomId: string }>;
}) {
  const staff = await getCurrentStaff();
  if (!staff) redirect("/login");

  const { roomId } = await params;
  const room = await prisma.translationRoom.findFirst({
    where: { id: roomId, hostStaffId: staff.id },
    select: {
      id: true,
      status: true,
      patientLanguage: true,
      patientJoinedAt: true,
      patientJoinCode: true,
      roomMode: true,
      hospital: { select: { name: true } },
      usageSession: {
        select: {
          totalRoomSeconds: true,
          roomStartedAt: true,
          roomEndedAt: true
        }
      }
    }
  });

  if (!room) redirect("/staff/kiosk");
  if (room.roomMode !== "procedure") redirect("/staff");

  const patientJoinCode = await ensurePatientJoinCode(room);

  return (
    <DualHardwareKioskRoom
      patientJoinCode={patientJoinCode}
      room={{
        id: room.id,
        status: room.status,
        patientLanguage: room.patientLanguage,
        patientJoinedAt: room.patientJoinedAt?.toISOString() ?? null,
        hospital: { name: room.hospital.name },
        usageSession: room.usageSession
          ? {
              totalRoomSeconds: room.usageSession.totalRoomSeconds,
              roomStartedAt: room.usageSession.roomStartedAt.toISOString(),
              roomEndedAt: room.usageSession.roomEndedAt?.toISOString() ?? null
            }
          : null
      }}
    />
  );
}
