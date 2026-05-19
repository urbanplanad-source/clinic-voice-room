import { redirect } from "next/navigation";
import { AppFrame } from "@/components/AppFrame";
import { StaffRoom } from "@/components/StaffRoom";
import { prisma } from "@/lib/prisma";
import { getCurrentStaff } from "@/lib/session";

export default async function StaffRoomPage({
  params,
  searchParams
}: {
  params: Promise<{ roomId: string }>;
  searchParams: Promise<{ mode?: string }>;
}) {
  const staff = await getCurrentStaff();
  if (!staff) redirect("/login");

  const { roomId } = await params;
  const room = await prisma.translationRoom.findFirst({
    where: { id: roomId, hostStaffId: staff.id },
    include: { hospital: true }
  });

  if (!room) redirect("/staff");

  const { mode } = await searchParams;
  const roomMode = mode === "procedure" ? "procedure" : "consultation";
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const joinUrl = `${baseUrl}/room/join/${room.roomToken}?mode=${roomMode}`;
  const androidJoinUrl = `clinicvoiceroom://room/join?token=${encodeURIComponent(room.roomToken)}&mode=${roomMode}&backend=${encodeURIComponent(baseUrl)}`;

  return (
    <AppFrame narrow backHref="/staff" backLabel="직원 화면으로">
      <StaffRoom
        room={{
          id: room.id,
          roomToken: room.roomToken,
          status: room.status,
          patientLanguage: room.patientLanguage,
          hospital: { name: room.hospital.name }
        }}
        joinUrl={joinUrl}
        androidJoinUrl={androidJoinUrl}
        roomMode={roomMode}
      />
    </AppFrame>
  );
}
