import { AppFrame } from "@/components/AppFrame";
import { PatientJoin } from "@/components/PatientJoin";
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
    return (
      <AppFrame narrow backHref="/staff">
        <section className="rounded-lg bg-white p-6 shadow-soft">
          <h1 className="text-2xl font-bold">Room not available</h1>
          <p className="mt-3 text-slate-600">This interpretation room has ended or cannot be found.</p>
        </section>
      </AppFrame>
    );
  }

  return (
    <AppFrame narrow backHref="/staff">
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
