import { cookies } from "next/headers";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { legacyRoomTokenAccessEnabled } from "./legacy-room-token";

const cookieName = "cvr_patient_room";
const patientSessionMaxAgeSeconds = 60 * 60 * 12;

type PatientRoomSessionPayload = {
  roomId: string;
  roomTokenHash: string;
  exp: number;
};

type PatientRoomSessionRoom = {
  id: string;
  roomToken: string;
  status?: string;
};

function secret() {
  const value = process.env.SESSION_SECRET;
  if (!value && process.env.NODE_ENV === "production") {
    throw new Error("SESSION_SECRET is required in production.");
  }
  return value ?? "dev-only-session-secret-change-me";
}

function sign(value: string) {
  return createHmac("sha256", secret()).update(value).digest("base64url");
}

function roomTokenHash(roomToken: string) {
  return createHash("sha256").update(roomToken).digest("base64url");
}

function encode(payload: PatientRoomSessionPayload) {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${sign(body)}`;
}

function decode(token?: string): PatientRoomSessionPayload | null {
  try {
    if (!token) return null;
    const [body, signature] = token.split(".");
    if (!body || !signature) return null;
    const expected = sign(body);
    const actualBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expected);
    if (actualBuffer.length !== expectedBuffer.length || !timingSafeEqual(actualBuffer, expectedBuffer)) {
      return null;
    }
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as PatientRoomSessionPayload;
    if (payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

export async function setPatientRoomSession(room: PatientRoomSessionRoom) {
  const cookieStore = await cookies();
  cookieStore.set(
    cookieName,
    encode({
      roomId: room.id,
      roomTokenHash: roomTokenHash(room.roomToken),
      exp: Date.now() + patientSessionMaxAgeSeconds * 1000
    }),
    {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: patientSessionMaxAgeSeconds
    }
  );
}

export async function getPatientRoomSession() {
  const cookieStore = await cookies();
  return decode(cookieStore.get(cookieName)?.value);
}

export async function isPatientRoomSessionAuthorized(room: PatientRoomSessionRoom) {
  if (room.status === "ended") return false;
  const payload = await getPatientRoomSession();
  return Boolean(payload && payload.roomId === room.id && payload.roomTokenHash === roomTokenHash(room.roomToken));
}

export async function isPatientRoomRequestAuthorized(room: PatientRoomSessionRoom, legacyRoomToken?: string | null) {
  if (legacyRoomTokenAccessEnabled() && legacyRoomToken && legacyRoomToken === room.roomToken) return true;
  return isPatientRoomSessionAuthorized(room);
}
