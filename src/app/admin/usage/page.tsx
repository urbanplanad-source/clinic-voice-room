import { redirect } from "next/navigation";
import { AppFrame } from "@/components/AppFrame";
import { getCurrentStaff } from "@/lib/session";
import { getAdminUsageSummary } from "@/lib/admin-usage";

export default async function AdminUsagePage() {
  const staff = await getCurrentStaff();
  if (!staff) redirect("/login");
  if (staff.role !== "internal_admin") redirect("/staff");

  const usage = await getAdminUsageSummary();

  return (
    <AppFrame>
      <div className="space-y-6">
        <header>
          <p className="text-sm font-bold text-trust">Internal Admin</p>
          <h1 className="mt-1 text-[30px] font-bold leading-tight">사용량 대시보드</h1>
        </header>

        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Metric label="병원" value={usage.totalHospitals} />
          <Metric label="파트너 무료" value={usage.planCounts.partner_free} />
          <Metric label="이번 달 방" value={usage.monthlyRoomCount} />
          <Metric label="이번 달 분" value={usage.monthlyActiveMinutes} />
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
              {usage.hospitals.map((hospital) => (
                <tr key={hospital.id} className="border-t border-line">
                  <td className="px-5 py-4 font-bold text-ink">{hospital.name}</td>
                  <td className="px-5 py-4 font-semibold text-slate-600">{hospital.planType}</td>
                  <td className="px-5 py-4 font-semibold text-slate-600">{hospital.sessions}</td>
                  <td className="px-5 py-4 font-semibold text-slate-600">{hospital.minutes}</td>
                  <td className="px-5 py-4 font-semibold text-slate-600">
                    {hospital.lastUsed ? hospital.lastUsed.toLocaleDateString("ko-KR") : "-"}
                  </td>
                </tr>
              ))}
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
