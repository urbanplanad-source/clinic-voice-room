import { redirect } from "next/navigation";
import { AppFrame } from "@/components/AppFrame";
import { getCurrentStaff } from "@/lib/session";
import { getAdminUsageSummary, type LocalQualityBreakdown } from "@/lib/admin-usage";
import { languageLabels } from "@/lib/languages";

const minimumReliableSample = 20;

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
          <p className="text-sm font-bold text-trust-text">Internal Admin</p>
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
            <p className="mt-1 text-sm font-semibold text-slate-500">MediVoice 0.3.38 이상 비식별 계측</p>
          </div>
          {quality.turnCount < minimumReliableSample ? (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">
              현재 계측 턴이 {quality.turnCount}건입니다. {minimumReliableSample}건 이상 쌓인 뒤 비율과 p95를 운영 판단에 사용하세요.
            </p>
          ) : null}
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

        <section className="space-y-4">
          <div>
            <h2 className="text-lg font-bold text-ink">품질·지연 상세</h2>
            <p className="mt-1 text-sm font-semibold text-slate-500">특정 방향·언어·전송 경로·앱 버전에 문제가 몰리는지 비교합니다.</p>
          </div>
          <QualityBreakdownTable
            title="번역 방향"
            rows={usage.localQualityBreakdowns.directions}
            labelForKey={(key) => directionLabel(key)}
          />
          <QualityBreakdownTable
            title="고객 언어"
            rows={usage.localQualityBreakdowns.languages}
            labelForKey={(key) => languageLabel(key)}
          />
          <div className="grid items-start gap-4 xl:grid-cols-2">
            <QualityBreakdownTable title="전송 경로" rows={usage.localQualityBreakdowns.transports} />
            <QualityBreakdownTable title="앱 버전" rows={usage.localQualityBreakdowns.appVersions} />
          </div>
          <ErrorCategoryTable rows={usage.localQualityErrors} />
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

function QualityBreakdownTable({
  title,
  rows,
  labelForKey = (key) => key
}: {
  title: string;
  rows: LocalQualityBreakdown[];
  labelForKey?: (key: string) => string;
}) {
  return (
    <div className="overflow-x-auto rounded-lg bg-white shadow-sm">
      <div className="border-b border-line px-5 py-4">
        <h3 className="font-bold text-ink">{title}</h3>
      </div>
      <table className="w-full min-w-[820px] border-collapse text-left text-sm">
        <thead className="bg-slate-50 text-xs font-bold text-slate-500">
          <tr>
            <th className="px-4 py-3">구분</th>
            <th className="px-4 py-3">턴</th>
            <th className="px-4 py-3">성공</th>
            <th className="px-4 py-3">재요청</th>
            <th className="px-4 py-3">교정</th>
            <th className="px-4 py-3">Upload</th>
            <th className="px-4 py-3">결과 p95</th>
            <th className="px-4 py-3">음성 p95</th>
          </tr>
        </thead>
        <tbody>
          {rows.length > 0 ? rows.map((row) => (
            <tr key={row.key} className="border-t border-line">
              <td className="px-4 py-3 font-bold text-ink">{labelForKey(row.key)}</td>
              <td className="px-4 py-3 font-semibold text-slate-600">{row.turnCount}</td>
              <td className="px-4 py-3 font-semibold text-slate-600">{formatPercent(row.successRate)}</td>
              <td className="px-4 py-3 font-semibold text-slate-600">{formatPercent(row.retryRate)}</td>
              <td className="px-4 py-3 font-semibold text-slate-600">{formatPercent(row.correctionRate)}</td>
              <td className="px-4 py-3 font-semibold text-slate-600">{formatPercent(row.uploadRate)}</td>
              <td className="px-4 py-3 font-semibold text-slate-600">{formatLatency(row.resultP95Ms)}</td>
              <td className="px-4 py-3 font-semibold text-slate-600">{formatLatency(row.audioP95Ms)}</td>
            </tr>
          )) : (
            <tr><td className="px-4 py-4 font-semibold text-slate-500" colSpan={8}>아직 계측 데이터가 없습니다.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function ErrorCategoryTable({ rows }: { rows: Array<{ errorCategory: string; eventCount: number }> }) {
  return (
    <div className="overflow-x-auto rounded-lg bg-white shadow-sm">
      <div className="border-b border-line px-5 py-4">
        <h3 className="font-bold text-ink">실패·검증 장애 분류</h3>
      </div>
      <table className="w-full min-w-[420px] border-collapse text-left text-sm">
        <thead className="bg-slate-50 text-xs font-bold text-slate-500">
          <tr><th className="px-4 py-3">오류 분류</th><th className="px-4 py-3">건수</th></tr>
        </thead>
        <tbody>
          {rows.length > 0 ? rows.map((row) => (
            <tr key={row.errorCategory} className="border-t border-line">
              <td className="px-4 py-3 font-bold text-ink">{errorCategoryLabel(row.errorCategory)}</td>
              <td className="px-4 py-3 font-semibold text-slate-600">{row.eventCount}</td>
            </tr>
          )) : (
            <tr><td className="px-4 py-4 font-semibold text-slate-500" colSpan={2}>이번 달 실패 기록이 없습니다.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function directionLabel(value: string) {
  if (value === "ko_to_patient") return "한국어 → 고객 언어";
  if (value === "patient_to_ko") return "고객 언어 → 한국어";
  return value;
}

function languageLabel(value: string) {
  return value in languageLabels
    ? `${languageLabels[value as keyof typeof languageLabels].ko} (${value})`
    : value;
}

function errorCategoryLabel(value: string) {
  const labels: Record<string, string> = {
    timeout: "시간 초과",
    network: "네트워크",
    empty_translation: "빈 번역",
    audio_too_short: "음성 너무 짧음",
    translation_error: "번역 오류",
    validation_unavailable: "검증 사용 불가",
    validation_mismatch: "검증 불일치",
    retry_prompt: "재발화 요청",
    unclassified: "미분류"
  };
  return labels[value] ?? value;
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
