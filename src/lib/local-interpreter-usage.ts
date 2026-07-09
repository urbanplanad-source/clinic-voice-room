import { Prisma } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { prisma } from "./prisma";
import type { getCurrentStaff } from "./session";
import type { PatientLanguage } from "./languages";

type StaffSession = NonNullable<Awaited<ReturnType<typeof getCurrentStaff>>>;

export type LocalInterpreterDirection = "ko_to_patient" | "patient_to_ko";
export type LocalInterpreterTransport = "realtime" | "upload";

export async function recordLocalInterpreterUsageTurn({
  staff,
  patientLanguage,
  direction,
  transport,
  durationSeconds,
  sourceTextCharacters,
  translatedTextCharacters
}: {
  staff: StaffSession;
  patientLanguage: PatientLanguage;
  direction: LocalInterpreterDirection;
  transport: LocalInterpreterTransport;
  durationSeconds: number;
  sourceTextCharacters?: number;
  translatedTextCharacters?: number;
}) {
  const safeDurationSeconds = Math.max(0, Math.min(60 * 30, Math.round(durationSeconds || 0)));
  const sourceChars =
    typeof sourceTextCharacters === "number" && Number.isFinite(sourceTextCharacters)
      ? Math.max(0, Math.round(sourceTextCharacters))
      : null;
  const translatedChars =
    typeof translatedTextCharacters === "number" && Number.isFinite(translatedTextCharacters)
      ? Math.max(0, Math.round(translatedTextCharacters))
      : null;
  const id = randomUUID();

  await prisma.$executeRaw(Prisma.sql`
    INSERT INTO "LocalInterpreterUsageTurn" (
      "id",
      "hospitalId",
      "staffId",
      "patientLanguage",
      "direction",
      "transport",
      "durationSeconds",
      "sourceTextCharacters",
      "translatedTextCharacters"
    )
    VALUES (
      ${id},
      ${staff.hospitalId},
      ${staff.id},
      ${patientLanguage}::"PatientLanguage",
      ${direction},
      ${transport},
      ${safeDurationSeconds},
      ${sourceChars},
      ${translatedChars}
    )
  `);

  return { id };
}
