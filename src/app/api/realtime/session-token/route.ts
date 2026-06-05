import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentStaff } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { createRealtimeSessionToken } from "@/lib/openai-realtime";
import { clientIp, rateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { isPatientRoomRequestAuthorized } from "@/lib/patient-room-session";

const schema = z.object({
  roomId: z.string(),
  role: z.enum(["staff", "patient"]),
  roomToken: z.string().optional(),
  direction: z.enum(["staff_to_patient", "patient_to_staff"]).optional(),
  manualTurn: z.boolean().optional()
});

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid token request" }, { status: 400 });
  }

  const limited = await rateLimit({
    key: `realtime-token:${clientIp(request)}:${parsed.data.roomId}:${parsed.data.role}`,
    limit: 40,
    windowMs: 60 * 1000
  });
  if (!limited.ok) {
    return rateLimitResponse(limited.retryAfter);
  }

  const room = await prisma.translationRoom.findUnique({ where: { id: parsed.data.roomId } });
  if (!room || room.status === "ended") {
    return NextResponse.json({ error: "Room not available" }, { status: 404 });
  }
  if (room.roomMode !== "procedure" && room.roomMode !== "consultation") {
    return NextResponse.json({ error: "Room not available" }, { status: 404 });
  }

  if (
    (parsed.data.direction === "staff_to_patient" && parsed.data.role !== "staff") ||
    (parsed.data.direction === "patient_to_staff" && parsed.data.role !== "patient")
  ) {
    return NextResponse.json({ error: "Invalid token direction" }, { status: 400 });
  }

  if (parsed.data.role === "staff") {
    const staff = await getCurrentStaff();
    if (!staff || staff.id !== room.hostStaffId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  } else if (!(await isPatientRoomRequestAuthorized(room, parsed.data.roomToken))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let token;
  try {
    token = await createRealtimeSessionToken({
      role: parsed.data.role,
      patientLanguage: room.patientLanguage,
      direction: parsed.data.direction,
      manualTurn: parsed.data.manualTurn,
      safetyIdentifier: `${room.hospitalId}:${room.hostStaffId}:${room.id}:${parsed.data.role}:${parsed.data.direction ?? "default"}`
    });
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : "Realtime translation token request failed";
    console.error("[realtime/session-token]", message);
    return NextResponse.json({ error: "Realtime translation session token could not be created" }, { status: 502 });
  }

  return NextResponse.json({ token });
}
