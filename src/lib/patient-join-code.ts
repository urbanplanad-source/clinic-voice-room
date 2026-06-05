import { randomBytes } from "node:crypto";
import { prisma } from "./prisma";

export function createPatientJoinCode() {
  return randomBytes(18).toString("base64url");
}

export async function ensurePatientJoinCode(room: { id: string; patientJoinCode: string | null }) {
  if (room.patientJoinCode) return room.patientJoinCode;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const updated = await prisma.translationRoom.update({
        where: { id: room.id },
        data: { patientJoinCode: createPatientJoinCode() },
        select: { patientJoinCode: true }
      });
      if (updated.patientJoinCode) return updated.patientJoinCode;
    } catch (caught) {
      if (attempt === 2) throw caught;
    }
  }

  throw new Error("Could not create patient join code.");
}
