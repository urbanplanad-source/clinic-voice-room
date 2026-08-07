import { redirect } from "next/navigation";
import { AppFrame } from "@/components/AppFrame";
import { legacyRoomTokenAccessEnabled } from "@/lib/legacy-room-token";
import { PatientRoomUnavailable } from "@/components/PatientRoomUnavailable";
import { prisma } from "@/lib/prisma";

export default async function PatientRoomPage({
  params
}: {
  params: Promise<{ roomToken: string }>;
}) {
  const { roomToken } = await params;
  if (!legacyRoomTokenAccessEnabled()) {
    return (
      <AppFrame narrow>
        <PatientRoomUnavailable />
      </AppFrame>
    );
  }

  const room = await prisma.translationRoom.findUnique({
    where: { roomToken },
    select: { roomToken: true, patientJoinCode: true, roomMode: true }
  });

  if (!room) {
    return (
      <AppFrame narrow>
        <PatientRoomUnavailable />
      </AppFrame>
    );
  }

  redirect(`/room/join/${room.patientJoinCode ?? room.roomToken}?mode=${room.roomMode}`);
}
