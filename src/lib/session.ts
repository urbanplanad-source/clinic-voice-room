import { cookies } from "next/headers";
import { createHmac, timingSafeEqual } from "node:crypto";
import { prisma } from "./prisma";

const cookieName = "cvr_session";
const defaultSessionMaxAgeSeconds = 60 * 60 * 12;
const rememberedSessionMaxAgeSeconds = 60 * 60 * 24 * 30;

type SessionPayload = {
  staffId: string;
  exp: number;
  sessionVersion: number;
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

function encode(payload: SessionPayload) {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${sign(body)}`;
}

function decode(token?: string): SessionPayload | null {
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
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as SessionPayload;
    if (payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

export async function setStaffSession(staffId: string, options: { remember?: boolean; sessionVersion?: number } = {}) {
  const cookieStore = await cookies();
  const maxAge = options.remember ? rememberedSessionMaxAgeSeconds : defaultSessionMaxAgeSeconds;
  const sessionVersion =
    options.sessionVersion ??
    (
      await prisma.staffUser.findUnique({
        where: { id: staffId },
        select: { sessionVersion: true }
      })
    )?.sessionVersion;

  if (typeof sessionVersion !== "number") throw new Error("Staff user not found.");

  cookieStore.set(cookieName, encode({ staffId, exp: Date.now() + maxAge * 1000, sessionVersion }), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge
  });
}

export async function clearStaffSession() {
  const cookieStore = await cookies();
  cookieStore.delete(cookieName);
}

export async function getCurrentStaff() {
  const cookieStore = await cookies();
  const payload = decode(cookieStore.get(cookieName)?.value);
  if (!payload) return null;

  const staff = await prisma.staffUser.findFirst({
    where: { id: payload.staffId, isActive: true },
    include: { hospital: true }
  });
  if (!staff || payload.sessionVersion !== staff.sessionVersion) {
    return null;
  }

  return staff;
}
