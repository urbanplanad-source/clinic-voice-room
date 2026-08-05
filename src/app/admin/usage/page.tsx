import { redirect } from "next/navigation";
import { AppFrame } from "@/components/AppFrame";
import { getCurrentStaff } from "@/lib/session";
import { getAdminUsageSummary } from "@/lib/admin-usage";

export default async function AdminUsagePage() {
  const staff = await getCurrentStaff();
  if (!staff) redirect("/login");
  if (staff.role !== "internal_admin") redirect("/staff");

  const usage = await getAdminUsageSummary();
  const quality = usage.localQuality;

  return (
    <AppFrame backHref="/staff">
      <div className="space-y-6">
        <header>
          <p className="text-sm font-bold text-trust">Internal Admin</p>
          <h1 className="mt-1 text-[30px] font-bold leading-tight">사용량 대시보드</h1>
        </header>

        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <Metric label="표시 병원" value={usage.totalHospitals} />
          <Metric label="파트너 무료" value={usage.planCounts.partner_free} />
          <Metric label="This month rooms" value={usage.monthlyRoomCount} />
          <Metric label="Face-to-face turns" value={usage.monthlyLocalTurnCount} />
          <Metric label="Text translations" value={usage.monthlyTextTranslationCount} />
        </section>

        <section className="space-y-3">
          <div>
            <h2 className="text-lg font-bold text-ink">대면 통역 품질 · 이번 달</h2>
            <p className="mt-1 text-sm font-semibold text-slate-500">MediVoice 0.3.37 이상 비식별 계측</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Metric label="계측 턴" value={quality.turnCount} />
            <Metric label="성공률" value={formatPercent(quality.successRate)} />
            <Metric label="재요청률" value={formatPercent(quality.retryRate)} />
            <Metric label="오류율" value={formatPercent(quality.errorRate)} />
            <Metric label="자동 교정률" value={formatPercent(quality.correctionRate)} />
            <Metric label="Upload fallback" value={formatPercent(quality.uploadRate)} />
            <Metric label="결과 준비 p50 / p95" value={formatLatencyPair(quality.resultP50Ms, quality.resultP95Ms)} />
            <Metric label="음성 시작 p50 / p95" value={formatLatencyPair(quality.audioP50Ms, quality.audioP95Ms)} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Metric label="검증 p50 / p95" value={formatLatencyPair(quality.validationP50Ms, quality.validationP95Ms)} />
            <Metric label="검증 문장 즉시 처리" value={formatPercent(quality.verifiedRate)} />
          </div>
        </section>

        <section className="overflow-x-auto rounded-lg bg-white shadow-soft">
          <table className="w-full min-w-[1120px] border-collapse text-left text-sm">
            <thead className="bg-slate-50 text-xs font-bold uppercase text-slate-500">
              <tr>
                <th className="px-5 py-4">Hospital</th>
                <th className="px-5 py-4">Plan</th>
                <th className="px-5 py-4">This month rooms</th>
                <th className="px-5 py-4">Face-to-face turns</th>
                <th className="px-5 py-4">Text translations</th>
                <th className="px-5 py-4">계측 턴</th>
                <th className="px-5 py-4">성공률</th>
                <th className="px-5 py-4">재요청률</th>
                <th className="px-5 py-4">Upload</th>
                <th className="px-5 py-4">결과 p95</th>
                <th className="px-5 py-4">음성 p95</th>
                <th className="px-5 py-4">Last used</th>
              </tr>
            </thead>
            <tbody>
              {usage.hospitals.map((hospital) => (
                <tr key={hospital.id} className="border-t border-line">
                  <td className="px-5 py-4 font-bold text-ink">{hospital.name}</td>
                  <td className="px-5 py-4 font-semibold text-slate-600">{hospital.planType}</td>
                  <td className="px-5 py-4 font-semibold text-slate-600">{hospital.thisMonthRooms}</td>
                  <td className="px-5 py-4 font-semibold text-slate-600">{hospital.localTurns}</td>
                  <td className="px-5 py-4 font-semibold text-slate-600">{hospital.textTranslations}</td>
                  <td className="px-5 py-4 font-semibold text-slate-600">{hospital.localQuality.turnCount}</td>
                  <td className="px-5 py-4 font-semibold text-slate-600">{formatPercent(hospital.localQuality.successRate)}</td>
                  <td className="px-5 py-4 font-semibold text-slate-600">{formatPercent(hospital.localQuality.retryRate)}</td>
                  <td className="px-5 py-4 font-semibold text-slate-600">{formatPercent(hospital.localQuality.uploadRate)}</td>
                  <td className="px-5 py-4 font-semibold text-slate-600">{formatLatency(hospital.localQuality.resultP95Ms)}</td>
                  <td className="px-5 py-4 font-semibold text-slate-600">{formatLatency(hospital.localQuality.audioP95Ms)}</td>
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

function formatPercent(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}

function formatLatency(value: number) {
  return value > 0 ? `${Math.round(value)}ms` : "-";
}

function formatLatencyPair(p50: number, p95: number) {
  if (p50 <= 0 && p95 <= 0) return "-";
  return `${Math.round(p50)} / ${Math.round(p95)}ms`;
}

function Metric({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-lg bg-white p-5 shadow-sm">
      <p className="text-sm font-semibold text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-bold text-ink">{value}</p>
    </div>
  );
}
