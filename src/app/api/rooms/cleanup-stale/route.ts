import { NextResponse } from "next/server";
import { getCurrentStaff } from "@/lib/session";
import { endStaleRooms } from "@/lib/stale-rooms";
import { getStaleRoomMinutes } from "@/lib/room-limits";

function isAuthorizedCron(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

export async function POST(request: Request) {
  const staff = await getCurrentStaff();
  if (!isAuthorizedCron(request) && staff?.role !== "internal_admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const result = await endStaleRooms();
  return NextResponse.json({
    ...result,
    staleRoomMinutes: getStaleRoomMinutes()
  });
}
