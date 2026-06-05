import { redirect } from "next/navigation";
import { AppFrame } from "@/components/AppFrame";
import { legacyRoomTokenAccessEnabled } from "@/lib/legacy-room-token";
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
        <section className="rounded-lg bg-white p-6 shadow-soft">
          <h1 className="text-2xl font-bold">Room link expired</h1>
          <p className="mt-3 text-slate-600">Please scan the latest QR code from the hospital staff.</p>
        </section>
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
        <section className="rounded-lg bg-white p-6 shadow-soft">
          <h1 className="text-2xl font-bold">Room not found</h1>
        </section>
      </AppFrame>
    );
  }

  redirect(`/room/join/${room.patientJoinCode ?? room.roomToken}?mode=${room.roomMode}`);
}
