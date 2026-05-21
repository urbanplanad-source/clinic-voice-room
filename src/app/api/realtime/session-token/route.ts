import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentStaff } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { createRealtimeSessionToken } from "@/lib/openai-realtime";
import { clientIp, rateLimit, rateLimitResponse } from "@/lib/rate-limit";

const schema = z.object({
  roomId: z.string(),
  role: z.enum(["staff", "patient"]),
  roomToken: z.string().optional(),
  direction: z.enum(["staff_to_patient", "patient_to_staff"]).optional()
});

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid token request" }, { status: 400 });
  }

  const limited = rateLimit({
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

  if (parsed.data.direction) {
    if (parsed.data.roomToken !== room.roomToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  } else if (parsed.data.role === "staff") {
    const staff = await getCurrentStaff();
    if (!staff || staff.id !== room.hostStaffId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  } else if (parsed.data.roomToken !== room.roomToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let token;
  try {
    token = await createRealtimeSessionToken({
      role: parsed.data.role,
      patientLanguage: room.patientLanguage,
      direction: parsed.data.direction,
      safetyIdentifier: `${room.hospitalId}:${room.hostStaffId}:${room.id}:${parsed.data.role}:${parsed.data.direction ?? "default"}`
    });
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : "Realtime translation token request failed";
    console.error("[realtime/session-token]", message);
    return NextResponse.json({ error: "Realtime translation session token could not be created" }, { status: 502 });
  }

  return NextResponse.json({ token });
}
