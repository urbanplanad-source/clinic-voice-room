import { AppFrame } from "@/components/AppFrame";
import { VoiceRoom } from "@/components/VoiceRoom";
import { prisma } from "@/lib/prisma";

export default async function PatientRoomPage({
  params,
  searchParams
}: {
  params: Promise<{ roomToken: string }>;
  searchParams: Promise<{ mode?: string }>;
}) {
  const { roomToken } = await params;
  const { mode } = await searchParams;
  const roomMode = mode === "procedure" ? "procedure" : "consultation";
  const room = await prisma.translationRoom.findUnique({
    where: { roomToken },
    include: { hospital: true }
  });

  if (!room) {
    return (
      <AppFrame narrow>
        <section className="rounded-lg bg-white p-6 shadow-soft">
          <h1 className="text-2xl font-bold">Room not found</h1>
        </section>
      </AppFrame>
    );
  }

  return (
    <AppFrame narrow>
      <VoiceRoom
        role="patient"
        roomToken={room.roomToken}
        roomMode={roomMode}
        initialRoom={{
          id: room.id,
          status: room.status,
          patientLanguage: room.patientLanguage,
          hospital: { name: room.hospital.name }
        }}
      />
    </AppFrame>
  );
}
