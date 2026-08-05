import type { PlanType } from "@prisma/client";
import { prisma } from "./prisma";

const planTypes: PlanType[] = ["partner_free", "external_trial", "external_paid"];

type LocalUsageAggregate = {
  turnCount: number | bigint | string | null;
};

type LocalUsageHospitalGroup = LocalUsageAggregate & {
  hospitalId: string;
  lastUsed: Date | null;
};

type TextUsageAggregate = {
  translationCount: number | bigint | string | null;
};

type TextUsageHospitalGroup = TextUsageAggregate & {
  hospitalId: string;
  lastUsed: Date | null;
};

type LocalQualityAggregate = {
  hospitalId?: string;
  turnCount: number | bigint | string | null;
  successCount: number | bigint | string | null;
  retryCount: number | bigint | string | null;
  errorCount: number | bigint | string | null;
  correctedCount: number | bigint | string | null;
  verifiedCount: number | bigint | string | null;
  uploadCount: number | bigint | string | null;
  resultP50Ms: number | string | null;
  resultP95Ms: number | string | null;
  audioP50Ms: number | string | null;
  audioP95Ms: number | string | null;
  validationP50Ms: number | string | null;
  validationP95Ms: number | string | null;
};

function numeric(value: number | bigint | string | null | undefined) {
  if (typeof value === "bigint") return Number(value);
  if (typeof value === "string") return Number(value);
  return value ?? 0;
}

function qualitySummary(row?: LocalQualityAggregate) {
  const turnCount = numeric(row?.turnCount);
  const ratio = (value: number | bigint | string | null | undefined) =>
    turnCount > 0 ? numeric(value) / turnCount : 0;

  return {
    turnCount,
    successRate: ratio(row?.successCount),
    retryRate: ratio(row?.retryCount),
    errorRate: ratio(row?.errorCount),
    correctionRate: ratio(row?.correctedCount),
    verifiedRate: ratio(row?.verifiedCount),
    uploadRate: ratio(row?.uploadCount),
    resultP50Ms: numeric(row?.resultP50Ms),
    resultP95Ms: numeric(row?.resultP95Ms),
    audioP50Ms: numeric(row?.audioP50Ms),
    audioP95Ms: numeric(row?.audioP95Ms),
    validationP50Ms: numeric(row?.validationP50Ms),
    validationP95Ms: numeric(row?.validationP95Ms)
  };
}

function latestDate(...values: Array<Date | null | undefined>) {
  return values.reduce<Date | null>((latest, value) => {
    if (!value) return latest;
    if (!latest || value > latest) return value;
    return latest;
  }, null);
}

export async function getAdminUsageSummary() {
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const [
    hospitals,
    monthlyRoomTotals,
    monthlyRoomsByHospital,
    roomLastUsedByHospital,
    localMonthlyTotals,
    localMonthlyByHospital,
    localLastUsedByHospital,
    textMonthlyTotals,
    textMonthlyByHospital,
    textLastUsedByHospital,
    qualityMonthlyTotals,
    qualityMonthlyByHospital
  ] = await Promise.all([
    prisma.hospital.findMany({
      select: {
        id: true,
        name: true,
        planType: true,
        staffUsers: {
          select: { id: true, isActive: true }
        }
      },
      orderBy: { name: "asc" }
    }),
    prisma.usageSession.aggregate({
      where: { roomStartedAt: { gte: monthStart } },
      _count: { id: true }
    }),
    prisma.usageSession.groupBy({
      by: ["hospitalId"],
      where: { roomStartedAt: { gte: monthStart } },
      _count: { id: true }
    }),
    prisma.usageSession.groupBy({
      by: ["hospitalId"],
      _max: { roomStartedAt: true }
    }),
    prisma.$queryRaw<LocalUsageAggregate[]>`
      SELECT COUNT(*)::int AS "turnCount"
      FROM "LocalInterpreterUsageTurn"
      WHERE "createdAt" >= ${monthStart}
    `,
    prisma.$queryRaw<LocalUsageHospitalGroup[]>`
      SELECT
        "hospitalId",
        COUNT(*)::int AS "turnCount",
        MAX("createdAt") AS "lastUsed"
      FROM "LocalInterpreterUsageTurn"
      WHERE "createdAt" >= ${monthStart}
      GROUP BY "hospitalId"
    `,
    prisma.$queryRaw<LocalUsageHospitalGroup[]>`
      SELECT
        "hospitalId",
        COUNT(*)::int AS "turnCount",
        MAX("createdAt") AS "lastUsed"
      FROM "LocalInterpreterUsageTurn"
      GROUP BY "hospitalId"
    `,
    prisma.$queryRaw<TextUsageAggregate[]>`
      SELECT COUNT(*)::int AS "translationCount"
      FROM "TextTranslationUsage"
      WHERE "createdAt" >= ${monthStart}
    `,
    prisma.$queryRaw<TextUsageHospitalGroup[]>`
      SELECT
        "hospitalId",
        COUNT(*)::int AS "translationCount",
        MAX("createdAt") AS "lastUsed"
      FROM "TextTranslationUsage"
      WHERE "createdAt" >= ${monthStart}
      GROUP BY "hospitalId"
    `,
    prisma.$queryRaw<TextUsageHospitalGroup[]>`
      SELECT
        "hospitalId",
        COUNT(*)::int AS "translationCount",
        MAX("createdAt") AS "lastUsed"
      FROM "TextTranslationUsage"
      GROUP BY "hospitalId"
    `,
    prisma.$queryRaw<LocalQualityAggregate[]>`
      SELECT
        COUNT(*)::int AS "turnCount",
        COUNT(*) FILTER (WHERE "outcome" = 'success')::int AS "successCount",
        COUNT(*) FILTER (WHERE "outcome" = 'retry_prompt')::int AS "retryCount",
        COUNT(*) FILTER (WHERE "outcome" = 'error')::int AS "errorCount",
        COUNT(*) FILTER (WHERE "corrected")::int AS "correctedCount",
        COUNT(*) FILTER (WHERE "verifiedSentence")::int AS "verifiedCount",
        COUNT(*) FILTER (WHERE "transport" = 'upload')::int AS "uploadCount",
        (PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY "resultReadyMs") FILTER (WHERE "resultReadyMs" IS NOT NULL))::float8 AS "resultP50Ms",
        (PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY "resultReadyMs") FILTER (WHERE "resultReadyMs" IS NOT NULL))::float8 AS "resultP95Ms",
        (PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY "audioStartedMs") FILTER (WHERE "audioStartedMs" IS NOT NULL))::float8 AS "audioP50Ms",
        (PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY "audioStartedMs") FILTER (WHERE "audioStartedMs" IS NOT NULL))::float8 AS "audioP95Ms",
        (PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY "validationMs") FILTER (WHERE "validationMs" IS NOT NULL))::float8 AS "validationP50Ms",
        (PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY "validationMs") FILTER (WHERE "validationMs" IS NOT NULL))::float8 AS "validationP95Ms"
      FROM "LocalInterpreterTurnMetric"
      WHERE "createdAt" >= ${monthStart}
    `,
    prisma.$queryRaw<LocalQualityAggregate[]>`
      SELECT
        "hospitalId",
        COUNT(*)::int AS "turnCount",
        COUNT(*) FILTER (WHERE "outcome" = 'success')::int AS "successCount",
        COUNT(*) FILTER (WHERE "outcome" = 'retry_prompt')::int AS "retryCount",
        COUNT(*) FILTER (WHERE "outcome" = 'error')::int AS "errorCount",
        COUNT(*) FILTER (WHERE "corrected")::int AS "correctedCount",
        COUNT(*) FILTER (WHERE "verifiedSentence")::int AS "verifiedCount",
        COUNT(*) FILTER (WHERE "transport" = 'upload')::int AS "uploadCount",
        (PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY "resultReadyMs") FILTER (WHERE "resultReadyMs" IS NOT NULL))::float8 AS "resultP50Ms",
        (PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY "resultReadyMs") FILTER (WHERE "resultReadyMs" IS NOT NULL))::float8 AS "resultP95Ms",
        (PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY "audioStartedMs") FILTER (WHERE "audioStartedMs" IS NOT NULL))::float8 AS "audioP50Ms",
        (PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY "audioStartedMs") FILTER (WHERE "audioStartedMs" IS NOT NULL))::float8 AS "audioP95Ms",
        (PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY "validationMs") FILTER (WHERE "validationMs" IS NOT NULL))::float8 AS "validationP50Ms",
        (PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY "validationMs") FILTER (WHERE "validationMs" IS NOT NULL))::float8 AS "validationP95Ms"
      FROM "LocalInterpreterTurnMetric"
      WHERE "createdAt" >= ${monthStart}
      GROUP BY "hospitalId"
    `
  ]);

  const monthlyRoomsByHospitalId = new Map(monthlyRoomsByHospital.map((usage) => [usage.hospitalId, usage]));
  const roomLastUsedByHospitalId = new Map(roomLastUsedByHospital.map((usage) => [usage.hospitalId, usage]));
  const localMonthlyByHospitalId = new Map(localMonthlyByHospital.map((usage) => [usage.hospitalId, usage]));
  const localLastUsedByHospitalId = new Map(localLastUsedByHospital.map((usage) => [usage.hospitalId, usage]));
  const textMonthlyByHospitalId = new Map(textMonthlyByHospital.map((usage) => [usage.hospitalId, usage]));
  const textLastUsedByHospitalId = new Map(textLastUsedByHospital.map((usage) => [usage.hospitalId, usage]));
  const qualityByHospitalId = new Map(qualityMonthlyByHospital.map((quality) => [quality.hospitalId, quality]));

  const visibleHospitals = hospitals.filter((hospital) => hospital.staffUsers.some((staffUser) => staffUser.isActive));
  const planCounts = Object.fromEntries(planTypes.map((planType) => [planType, 0])) as Record<PlanType, number>;
  for (const hospital of visibleHospitals) {
    planCounts[hospital.planType] += 1;
  }

  return {
    totalHospitals: visibleHospitals.length,
    planCounts,
    monthlyRoomCount: monthlyRoomTotals._count.id,
    monthlyLocalTurnCount: numeric(localMonthlyTotals[0]?.turnCount),
    monthlyTextTranslationCount: numeric(textMonthlyTotals[0]?.translationCount),
    localQuality: qualitySummary(qualityMonthlyTotals[0]),
    hospitals: visibleHospitals.map((hospital) => {
      const monthlyRoomUsage = monthlyRoomsByHospitalId.get(hospital.id);
      const roomLastUsed = roomLastUsedByHospitalId.get(hospital.id)?._max.roomStartedAt ?? null;
      const localMonthlyUsage = localMonthlyByHospitalId.get(hospital.id);
      const localLastUsed = localLastUsedByHospitalId.get(hospital.id)?.lastUsed ?? null;
      const textMonthlyUsage = textMonthlyByHospitalId.get(hospital.id);
      const textLastUsed = textLastUsedByHospitalId.get(hospital.id)?.lastUsed ?? null;

      return {
        id: hospital.id,
        name: hospital.name,
        planType: hospital.planType,
        thisMonthRooms: monthlyRoomUsage?._count.id ?? 0,
        localTurns: numeric(localMonthlyUsage?.turnCount),
        textTranslations: numeric(textMonthlyUsage?.translationCount),
        localQuality: qualitySummary(qualityByHospitalId.get(hospital.id)),
        lastUsed: latestDate(roomLastUsed, localLastUsed, textLastUsed)
      };
    })
  };
}
