import { NextResponse } from "next/server";
import { getCurrentStaff } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const staff = await getCurrentStaff();
  if (!staff || staff.role !== "internal_admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const [hospitals, usage, languageGroups] = await Promise.all([
    prisma.hospital.findMany({ include: { usageSessions: true } }),
    prisma.usageSession.findMany({
      where: { roomStartedAt: { gte: monthStart } },
      include: { hospital: true }
    }),
    prisma.usageSession.groupBy({
      by: ["patientLanguage"],
      where: { roomStartedAt: { gte: monthStart } },
      _count: true,
      _sum: { totalRoomSeconds: true }
    })
  ]);

  const rows = hospitals.map((hospital) => {
    const sessions = hospital.usageSessions;
    const seconds = sessions.reduce((sum, item) => sum + item.totalRoomSeconds, 0);
    return {
      id: hospital.id,
      name: hospital.name,
      planType: hospital.planType,
      sessions: sessions.length,
      minutes: Math.round(seconds / 60),
      lastUsed: sessions.sort((a, b) => b.roomStartedAt.getTime() - a.roomStartedAt.getTime())[0]?.roomStartedAt ?? null
    };
  });

  return NextResponse.json({
    totalHospitals: hospitals.length,
    planCounts: {
      partner_free: hospitals.filter((hospital) => hospital.planType === "partner_free").length,
      external_trial: hospitals.filter((hospital) => hospital.planType === "external_trial").length,
      external_paid: hospitals.filter((hospital) => hospital.planType === "external_paid").length
    },
    monthlyRoomCount: usage.length,
    monthlyActiveMinutes: Math.round(usage.reduce((sum, item) => sum + item.totalRoomSeconds, 0) / 60),
    languageDistribution: languageGroups,
    hospitals: rows
  });
}
