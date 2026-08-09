import { AppFrame } from "@/components/AppFrame";
import { PatientRoomUnavailable } from "@/components/PatientRoomUnavailable";
import { VoiceRoom } from "@/components/VoiceRoom";
import { isPatientRoomSessionAuthorized } from "@/lib/patient-room-session";
import { prisma } from "@/lib/prisma";

export default async function PatientCookieRoomPage({
  params
}: {
  params: Promise<{ roomId: string }>;
}) {
  const { roomId } = await params;
  const room = await prisma.translationRoom.findUnique({
    where: { id: roomId },
    select: {
      id: true,
      roomToken: true,
      status: true,
      patientLanguage: true,
      roomMode: true,
      patientJoinedAt: true,
      hospital: { select: { name: true } }
    }
  });

  if (!room || !(await isPatientRoomSessionAuthorized(room))) {
    return (
      <AppFrame narrow>
        <PatientRoomUnavailable language={room?.patientLanguage} />
      </AppFrame>
    );
  }

  return (
    <AppFrame narrow roomViewport>
      <VoiceRoom
        role="patient"
        roomMode={room.roomMode}
        initialRoom={{
          id: room.id,
          status: room.status,
          patientLanguage: room.patientLanguage,
          patientJoinedAt: room.patientJoinedAt?.toISOString() ?? null,
          hospital: { name: room.hospital.name }
        }}
      />
    </AppFrame>
  );
}
