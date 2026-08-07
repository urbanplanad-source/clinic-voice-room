import { AppFrame } from "@/components/AppFrame";
import { PatientJoin } from "@/components/PatientJoin";
import { PatientRoomUnavailable } from "@/components/PatientRoomUnavailable";
import { legacyRoomTokenAccessEnabled } from "@/lib/legacy-room-token";
import { prisma } from "@/lib/prisma";

export default async function PatientJoinPage({
  params
}: {
  params: Promise<{ joinCode: string }>;
}) {
  const { joinCode } = await params;
  const credentialWhere = legacyRoomTokenAccessEnabled()
    ? [{ patientJoinCode: joinCode }, { roomToken: joinCode }]
    : [{ patientJoinCode: joinCode }];
  const room = await prisma.translationRoom.findFirst({
    where: {
      OR: credentialWhere
    },
    select: {
      id: true,
      status: true,
      patientLanguage: true,
      roomMode: true,
      hospital: { select: { name: true } }
    }
  });

  if (!room || room.status === "ended") {
    return <AppFrame narrow><PatientRoomUnavailable language={room?.patientLanguage} /></AppFrame>;
  }

  return (
    <AppFrame narrow>
      <PatientJoin
        joinCode={joinCode}
        room={{
          id: room.id,
          patientLanguage: room.patientLanguage,
          hospital: { name: room.hospital.name }
        }}
        roomMode={room.roomMode}
      />
    </AppFrame>
  );
}
