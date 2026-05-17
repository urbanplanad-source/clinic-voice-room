import type { PatientLanguage, PlanType } from "@prisma/client";
import { prisma } from "./prisma";
import { endStaleRooms } from "./stale-rooms";

const planTypes: PlanType[] = ["partner_free", "external_trial", "external_paid"];

export async function getAdminUsageSummary() {
  await endStaleRooms();

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const [hospitals, planGroups, monthlyTotals, languageGroups, usageByHospital] = await Promise.all([
    prisma.hospital.findMany({
      select: {
        id: true,
        name: true,
        planType: true
      },
      orderBy: { name: "asc" }
    }),
    prisma.hospital.groupBy({
      by: ["planType"],
      _count: { id: true }
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
    })
  ]);

  const usageByHospitalId = new Map(usageByHospital.map((usage) => [usage.hospitalId, usage]));
  const planCounts = Object.fromEntries(planTypes.map((planType) => [planType, 0])) as Record<PlanType, number>;
  for (const group of planGroups) {
    planCounts[group.planType] = group._count.id;
  }

  return {
    totalHospitals: hospitals.length,
    planCounts,
    monthlyRoomCount: monthlyTotals._count.id,
    monthlyActiveMinutes: Math.round((monthlyTotals._sum.totalRoomSeconds ?? 0) / 60),
    languageDistribution: languageGroups.map((group) => ({
      patientLanguage: group.patientLanguage as PatientLanguage,
      roomCount: group._count.id,
      minutes: Math.round((group._sum.totalRoomSeconds ?? 0) / 60)
    })),
    hospitals: hospitals.map((hospital) => {
      const usage = usageByHospitalId.get(hospital.id);
      return {
        id: hospital.id,
        name: hospital.name,
        planType: hospital.planType,
        sessions: usage?._count.id ?? 0,
        minutes: Math.round((usage?._sum.totalRoomSeconds ?? 0) / 60),
        lastUsed: usage?._max.roomStartedAt ?? null
      };
    })
  };
}
