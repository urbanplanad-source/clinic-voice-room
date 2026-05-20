import { AppFrame } from "@/components/AppFrame";
import { PatientJoin } from "@/components/PatientJoin";
import { prisma } from "@/lib/prisma";

export default async function PatientJoinPage({
  params
}: {
  params: Promise<{ roomToken: string }>;
}) {
  const { roomToken } = await params;
  const room = await prisma.translationRoom.findUnique({
    where: { roomToken },
    include: { hospital: true }
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
        room={{
          id: room.id,
          roomToken: room.roomToken,
          patientLanguage: room.patientLanguage,
          hospital: { name: room.hospital.name }
        }}
        roomMode={room.roomMode}
      />
    </AppFrame>
  );
}
