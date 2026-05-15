import { redirect } from "next/navigation";
import { AppFrame } from "@/components/AppFrame";
import { getCurrentStaff } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export default async function AdminUsagePage() {
  const staff = await getCurrentStaff();
  if (!staff) redirect("/login");
  if (staff.role !== "internal_admin") redirect("/staff");

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const hospitals = await prisma.hospital.findMany({ include: { usageSessions: true } });
  const monthlyUsage = hospitals.flatMap((hospital) =>
    hospital.usageSessions.filter((usage) => usage.roomStartedAt >= monthStart)
  );
  const minutes = Math.round(monthlyUsage.reduce((sum, usage) => sum + usage.totalRoomSeconds, 0) / 60);

  return (
    <AppFrame>
      <div className="space-y-6">
        <header>
          <p className="text-sm font-bold text-trust">Internal Admin</p>
          <h1 className="mt-1 text-[30px] font-bold leading-tight">사용량 대시보드</h1>
        </header>

        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Metric label="병원" value={hospitals.length} />
          <Metric label="파트너 무료" value={hospitals.filter((item) => item.planType === "partner_free").length} />
          <Metric label="이번 달 방" value={monthlyUsage.length} />
          <Metric label="이번 달 분" value={minutes} />
        </section>

        <section className="overflow-x-auto rounded-lg bg-white shadow-soft">
          <table className="w-full min-w-[720px] border-collapse text-left text-sm">
            <thead className="bg-slate-50 text-xs font-bold uppercase text-slate-500">
              <tr>
                <th className="px-5 py-4">Hospital</th>
                <th className="px-5 py-4">Plan</th>
                <th className="px-5 py-4">Sessions</th>
                <th className="px-5 py-4">Minutes</th>
                <th className="px-5 py-4">Last used</th>
              </tr>
            </thead>
            <tbody>
              {hospitals.map((hospital) => {
                const seconds = hospital.usageSessions.reduce((sum, usage) => sum + usage.totalRoomSeconds, 0);
                const lastUsed = hospital.usageSessions.sort((a, b) => b.roomStartedAt.getTime() - a.roomStartedAt.getTime())[0]?.roomStartedAt;
                return (
                  <tr key={hospital.id} className="border-t border-line">
                    <td className="px-5 py-4 font-bold text-ink">{hospital.name}</td>
                    <td className="px-5 py-4 font-semibold text-slate-600">{hospital.planType}</td>
                    <td className="px-5 py-4 font-semibold text-slate-600">{hospital.usageSessions.length}</td>
                    <td className="px-5 py-4 font-semibold text-slate-600">{Math.round(seconds / 60)}</td>
                    <td className="px-5 py-4 font-semibold text-slate-600">{lastUsed ? lastUsed.toLocaleDateString("ko-KR") : "-"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      </div>
    </AppFrame>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-white p-5 shadow-sm">
      <p className="text-sm font-semibold text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-bold text-ink">{value}</p>
    </div>
  );
}
