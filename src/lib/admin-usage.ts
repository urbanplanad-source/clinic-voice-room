import type { PatientLanguage, PlanType } from "@prisma/client";
import { prisma } from "./prisma";

const planTypes: PlanType[] = ["partner_free", "external_trial", "external_paid"];

type LocalUsageAggregate = {
  turnCount: number | bigint | string | null;
  totalSeconds: number | bigint | string | null;
};

type LocalUsageLanguageGroup = LocalUsageAggregate & {
  patientLanguage: PatientLanguage;
};

type LocalUsageHospitalGroup = LocalUsageAggregate & {
  hospitalId: string;
  lastUsed: Date | null;
};

function numeric(value: number | bigint | string | null | undefined) {
  if (typeof value === "bigint") return Number(value);
  if (typeof value === "string") return Number(value);
  return value ?? 0;
}

export async function getAdminUsageSummary() {
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const [hospitals, monthlyTotals, languageGroups, usageByHospital, localMonthlyTotals, localLanguageGroups, localUsageByHospital] =
    await Promise.all([
    prisma.hospital.findMany({
      select: {
        id: true,
        name: true,
        planType: true,
        staffUsers: {
          select: { id: true, isActive: true }
        },
        _count: {
          select: {
            rooms: true,
            usageSessions: true
          }
        }
      },
      orderBy: { name: "asc" }
    }),
    prisma.usageSession.aggregate({
      where: { roomStartedAt: { gte: monthStart } },
      _count: { id: true },
      _sum: { totalRoomSeconds: true }
    }),
    prisma.usageSession.groupBy({
      by: ["patientLanguage"],
      where: { roomStartedAt: { gte: monthStart } },
      _count: { id: true },
      _sum: { totalRoomSeconds: true }
    }),
    prisma.usageSession.groupBy({
      by: ["hospitalId"],
      _count: { id: true },
      _sum: { totalRoomSeconds: true },
      _max: { roomStartedAt: true }
    }),
    prisma.$queryRaw<LocalUsageAggregate[]>`
      SELECT
        COUNT(*)::int AS "turnCount",
        COALESCE(SUM("durationSeconds"), 0)::int AS "totalSeconds"
      FROM "LocalInterpreterUsageTurn"
      WHERE "createdAt" >= ${monthStart}
    `,
    prisma.$queryRaw<LocalUsageLanguageGroup[]>`
      SELECT
        "patientLanguage",
        COUNT(*)::int AS "turnCount",
        COALESCE(SUM("durationSeconds"), 0)::int AS "totalSeconds"
      FROM "LocalInterpreterUsageTurn"
      WHERE "createdAt" >= ${monthStart}
      GROUP BY "patientLanguage"
    `,
    prisma.$queryRaw<LocalUsageHospitalGroup[]>`
      SELECT
        "hospitalId",
        COUNT(*)::int AS "turnCount",
        COALESCE(SUM("durationSeconds"), 0)::int AS "totalSeconds",
        MAX("createdAt") AS "lastUsed"
      FROM "LocalInterpreterUsageTurn"
      GROUP BY "hospitalId"
    `
  ]);

  const usageByHospitalId = new Map(usageByHospital.map((usage) => [usage.hospitalId, usage]));
  const localUsageByHospitalId = new Map(localUsageByHospital.map((usage) => [usage.hospitalId, usage]));
  const localLanguageByCode = new Map(localLanguageGroups.map((usage) => [usage.patientLanguage, usage]));
  const visibleHospitals = hospitals.filter(
    (hospital) => hospital.staffUsers.some((staffUser) => staffUser.isActive)
  );
  const planCounts = Object.fromEntries(planTypes.map((planType) => [planType, 0])) as Record<PlanType, number>;
  for (const hospital of visibleHospitals) {
    planCounts[hospital.planType] += 1;
  }

  const localMonth = localMonthlyTotals[0];
  const monthlyLocalTurnCount = numeric(localMonth?.turnCount);
  const monthlyLocalSeconds = numeric(localMonth?.totalSeconds);
  const combinedLanguageCodes = Array.from(
    new Set<PatientLanguage>([
      ...languageGroups.map((group) => group.patientLanguage as PatientLanguage),
      ...localLanguageGroups.map((group) => group.patientLanguage)
    ])
  );

  return {
    totalHospitals: visibleHospitals.length,
    planCounts,
    monthlyRoomCount: monthlyTotals._count.id,
    monthlyLocalTurnCount,
    monthlyActiveMinutes: Math.round(((monthlyTotals._sum.totalRoomSeconds ?? 0) + monthlyLocalSeconds) / 60),
    languageDistribution: combinedLanguageCodes.map((patientLanguage) => {
      const roomGroup = languageGroups.find((group) => group.patientLanguage === patientLanguage);
      const localGroup = localLanguageByCode.get(patientLanguage);
      return {
        patientLanguage,
        roomCount: (roomGroup?._count.id ?? 0) + numeric(localGroup?.turnCount),
        localTurnCount: numeric(localGroup?.turnCount),
        minutes: Math.round(((roomGroup?._sum.totalRoomSeconds ?? 0) + numeric(localGroup?.totalSeconds)) / 60)
      };
    }),
    hospitals: visibleHospitals.map((hospital) => {
      const usage = usageByHospitalId.get(hospital.id);
      const localUsage = localUsageByHospitalId.get(hospital.id);
      const localTurnCount = numeric(localUsage?.turnCount);
      const localSeconds = numeric(localUsage?.totalSeconds);
      const roomLastUsed = usage?._max.roomStartedAt ?? null;
      const localLastUsed = localUsage?.lastUsed ?? null;
      return {
        id: hospital.id,
        name: hospital.name,
        planType: hospital.planType,
        sessions: usage?._count.id ?? 0,
        localTurns: localTurnCount,
        minutes: Math.round(((usage?._sum.totalRoomSeconds ?? 0) + localSeconds) / 60),
        lastUsed:
          roomLastUsed && localLastUsed
            ? roomLastUsed > localLastUsed
              ? roomLastUsed
              : localLastUsed
            : roomLastUsed ?? localLastUsed
      };
    })
  };
}
