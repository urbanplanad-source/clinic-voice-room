"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import readExcelFile from "read-excel-file/browser";
import { AdminDatasetReviewWorkspace } from "@/components/AdminDatasetReviewWorkspace";
import {
  AlertTriangle,
  ArrowLeft,
  BookOpenText,
  CheckCircle2,
  Database,
  Download,
  FileCheck2,
  FileSpreadsheet,
  Loader2,
  Search,
  ShieldCheck,
  Upload,
  XCircle
} from "lucide-react";
import {
  analyzeMedivoiceDatasets,
  type DatasetAssetType,
  type DatasetDryRunResult,
  type MedivoiceDatasetSpecialty
} from "@/lib/medivoice-dataset-import";

type FileSlot = {
  specialty: MedivoiceDatasetSpecialty;
  label: string;
  description: string;
};

const slots: FileSlot[] = [
  { specialty: "dermatology", label: "피부과", description: "MediVoice 피부과 v3" },
  { specialty: "plastic_surgery", label: "성형외과", description: "MediVoice 성형외과 v2.1" },
  { specialty: "oriental_medicine", label: "한의원", description: "MediVoice 한의원 v1.2" }
];

const specialtyLabels: Record<MedivoiceDatasetSpecialty, string> = {
  dermatology: "피부과",
  plastic_surgery: "성형외과",
  oriental_medicine: "한의원"
};

const assetLabels: Record<DatasetAssetType, string> = {
  term: "의료 용어",
  critical_phrase: "필수 표현",
  verified_sentence: "검증 문장"
};

function riskTone(risk: string) {
  if (risk === "critical") return "bg-rose-100 text-rose-800";
  if (risk === "high") return "bg-orange-100 text-orange-800";
  if (risk === "medium") return "bg-amber-100 text-amber-800";
  return "bg-slate-100 text-slate-600";
}

function issueTone(severity: "blocker" | "review" | "info") {
  if (severity === "blocker") return { icon: XCircle, box: "border-rose-200 bg-rose-50", text: "text-rose-800", label: "차단" };
  if (severity === "review") return { icon: AlertTriangle, box: "border-amber-200 bg-amber-50", text: "text-amber-800", label: "검토" };
  return { icon: CheckCircle2, box: "border-blue-200 bg-blue-50", text: "text-blue-800", label: "안내" };
}

export function AdminDatasetDryRun() {
  const [files, setFiles] = useState<Partial<Record<MedivoiceDatasetSpecialty, File>>>({});
  const [result, setResult] = useState<DatasetDryRunResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [filters, setFilters] = useState<{ query: string; specialty: "" | MedivoiceDatasetSpecialty; assetType: "" | DatasetAssetType }>({ query: "", specialty: "", assetType: "" });

  const selectedCount = Object.keys(files).length;
  const filteredCandidates = useMemo(() => {
    if (!result) return [];
    const query = filters.query.trim().toLocaleLowerCase();
    return result.candidates.filter((candidate) => {
      if (filters.specialty && candidate.specialty !== filters.specialty) return false;
      if (filters.assetType && candidate.assetType !== filters.assetType) return false;
      if (!query) return true;
      return [candidate.standardKo, candidate.category, candidate.sourceIds.join(" "), candidate.requiredTerms.join(" ")]
        .join(" ")
        .toLocaleLowerCase()
        .includes(query);
    });
  }, [filters, result]);

  function selectFile(specialty: MedivoiceDatasetSpecialty, file: File | undefined) {
    setResult(null);
    setError("");
    setFiles((current) => {
      const next = { ...current };
      if (file) next[specialty] = file;
      else delete next[specialty];
      return next;
    });
  }

  async function analyze() {
    if (selectedCount !== slots.length) return;
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const workbooks = await Promise.all(slots.map(async (slot) => {
        const file = files[slot.specialty];
        if (!file) throw new Error(`${slot.label} 파일이 없습니다.`);
        const sheets = await readExcelFile(file);
        return {
          fileName: file.name,
          expectedSpecialty: slot.specialty,
          sheets: sheets.map((sheet) => ({ sheet: sheet.sheet, data: sheet.data }))
        };
      }));
      setResult(analyzeMedivoiceDatasets(workbooks));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "엑셀 파일을 분석하지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }

  function downloadDryRun() {
    if (!result) return;
    const payload = JSON.stringify({ generatedAt: new Date().toISOString(), mode: "dry_run", databaseWrite: false, ...result }, null, 2);
    const url = URL.createObjectURL(new Blob([payload], { type: "application/json;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `medivoice-dataset-dry-run-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6 pb-12">
      <nav aria-label="번역 품질 관리" className="flex min-h-12 items-end gap-1 overflow-x-auto border-b border-line">
        <Link href="/admin/samples" className="inline-flex min-h-12 shrink-0 items-center gap-2 border-b-2 border-transparent px-4 text-sm font-bold text-slate-500 hover:text-ink">
          <FileCheck2 size={18} aria-hidden="true" /> 검수 대기함
        </Link>
        <Link href="/admin/glossary" className="inline-flex min-h-12 shrink-0 items-center gap-2 border-b-2 border-transparent px-4 text-sm font-bold text-slate-500 hover:text-ink">
          <BookOpenText size={18} aria-hidden="true" /> 품질 자산
        </Link>
        <span aria-current="page" className="inline-flex min-h-12 shrink-0 items-center gap-2 border-b-2 border-trust px-4 text-sm font-bold text-trust">
          <Database size={18} aria-hidden="true" /> 데이터셋 검수
        </span>
      </nav>

      <header className="grid gap-5 rounded-2xl bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 px-6 py-7 text-white shadow-soft lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
        <div>
          <p className="text-sm font-bold text-blue-200">MediVoice Quality Lab</p>
          <h1 className="mt-2 text-3xl font-bold tracking-[-0.025em]">기준 데이터셋 통합 검수</h1>
          <p className="mt-3 max-w-3xl text-sm font-medium leading-6 text-slate-300">
            피부과·성형외과·한의원 기준 데이터를 공통 용어, 진료과 자산, 안전 규칙과 회귀 테스트 후보로 분리합니다.
            이 화면에서는 운영 DB를 변경하지 않습니다.
          </p>
        </div>
        <div className="inline-flex w-fit items-center gap-2 rounded-full border border-emerald-300/30 bg-emerald-400/10 px-3 py-2 text-xs font-bold text-emerald-200">
          <ShieldCheck size={16} aria-hidden="true" /> 파일은 브라우저 안에서만 처리
        </div>
      </header>

      <section aria-labelledby="dataset-upload-title" className="rounded-2xl bg-white p-5 shadow-soft sm:p-7">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-trust">1. 파일 선택</p>
            <h2 id="dataset-upload-title" className="mt-1 text-xl font-bold text-ink">검수할 최신 엑셀 3개</h2>
          </div>
          <p className="text-sm font-semibold text-slate-500">{selectedCount}/3개 선택됨</p>
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-3">
          {slots.map((slot) => {
            const file = files[slot.specialty];
            return (
              <label key={slot.specialty} className={`group flex min-h-40 cursor-pointer flex-col justify-between rounded-xl border p-5 transition ${file ? "border-emerald-300 bg-emerald-50/60" : "border-dashed border-slate-300 bg-slate-50 hover:border-trust hover:bg-blue-50/40"}`}>
                <span>
                  <span className="flex items-center justify-between gap-3">
                    <span className="font-bold text-ink">{slot.label}</span>
                    {file ? <CheckCircle2 className="text-emerald-600" size={20} aria-hidden="true" /> : <Upload className="text-slate-400 group-hover:text-trust" size={20} aria-hidden="true" />}
                  </span>
                  <span className="mt-1 block text-xs font-semibold text-slate-500">{slot.description}</span>
                </span>
                <span className="mt-5 block min-w-0">
                  <span className="block truncate text-sm font-bold text-slate-700">{file?.name ?? ".xlsx 파일 선택"}</span>
                  {file ? <span className="mt-1 block text-xs text-slate-500">{(file.size / 1024).toFixed(0)} KB · 다시 선택 가능</span> : null}
                </span>
                <input className="sr-only" type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={(event) => selectFile(slot.specialty, event.target.files?.[0])} />
              </label>
            );
          })}
        </div>

        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs font-semibold text-slate-500">분석 결과는 승인 후보이며 자동 등록되지 않습니다.</p>
          <button type="button" disabled={selectedCount !== 3 || loading} onClick={() => void analyze()} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-trust px-5 text-sm font-bold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300">
            {loading ? <Loader2 className="animate-spin" size={18} aria-hidden="true" /> : <FileSpreadsheet size={18} aria-hidden="true" />}
            {loading ? "엑셀 분석 중" : "통합 dry-run 실행"}
          </button>
        </div>
        {error ? <p role="alert" className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">{error}</p> : null}
      </section>

      {result ? (
        <>
          <section aria-labelledby="dataset-summary-title" className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-trust">2. 분석 결과</p>
                <h2 id="dataset-summary-title" className="mt-1 text-xl font-bold text-ink">품질 자산 후보 요약</h2>
              </div>
              <button type="button" onClick={downloadDryRun} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-line bg-white px-4 text-sm font-bold text-ink shadow-sm hover:bg-slate-50">
                <Download size={17} aria-hidden="true" /> dry-run JSON 내려받기
              </button>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {[
                ["기준문장", result.summary.sourceSentenceCount],
                ["용어 원본", result.summary.glossaryTermCount],
                ["STT 매핑", result.summary.sttMappingCount],
                ["숫자 테스트", result.summary.numericTestCount],
                ["공통 병합", result.summary.globalMergeGroupCount],
                ["사람 승인 대기", result.summary.humanApprovalPendingCount],
                ["문장 QA 대기", result.summary.sourceReviewPendingCount],
                ["용어 검토 대기", result.summary.glossaryReviewPendingCount]
              ].map(([label, value]) => (
                <article key={String(label)} className="rounded-xl border border-line bg-white px-4 py-4 shadow-sm">
                  <p className="text-xs font-bold text-slate-500">{label}</p>
                  <p className="mt-1 text-2xl font-bold text-ink">{value}</p>
                </article>
              ))}
            </div>

            <div className={`flex flex-col gap-3 rounded-xl border px-5 py-4 sm:flex-row sm:items-center sm:justify-between ${result.summary.blockerCount ? "border-rose-200 bg-rose-50" : "border-amber-200 bg-amber-50"}`}>
              <div className="flex items-start gap-3">
                {result.summary.blockerCount ? <XCircle className="mt-0.5 text-rose-600" size={21} aria-hidden="true" /> : <AlertTriangle className="mt-0.5 text-amber-600" size={21} aria-hidden="true" />}
                <div>
                  <p className={`font-bold ${result.summary.blockerCount ? "text-rose-800" : "text-amber-900"}`}>{result.summary.blockerCount ? "구조 차단 항목이 있습니다" : "필수 구조 통과 · 아직 승격 전 검토 단계입니다"}</p>
                  <p className="mt-1 text-sm font-semibold text-slate-600">구조 차단 {result.summary.blockerCount}건 · 검토 메시지 {result.summary.reviewCount}건 · 사람 승인 대기 {result.summary.humanApprovalPendingCount}건</p>
                </div>
              </div>
              <span className="rounded-full bg-white px-3 py-1.5 text-xs font-bold text-slate-600 shadow-sm">운영 DB 변경 0건</span>
            </div>
          </section>

          <AdminDatasetReviewWorkspace key={result.files.map((file) => file.fileName).join("|")} result={result} />

          <section className="grid gap-5 xl:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.75fr)]">
            <div className="rounded-2xl bg-white p-5 shadow-soft sm:p-6">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-trust">4. 후보 탐색</p>
                  <h2 className="mt-1 text-xl font-bold text-ink">통합 품질 자산</h2>
                </div>
                <p className="text-xs font-bold text-slate-500">{filteredCandidates.length}개</p>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_160px_160px]">
                <label className="relative">
                  <span className="sr-only">품질 자산 검색</span>
                  <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={17} aria-hidden="true" />
                  <input value={filters.query} onChange={(event) => setFilters((current) => ({ ...current, query: event.target.value }))} placeholder="문장·용어·ID 검색" className="h-11 w-full rounded-xl border border-line bg-slate-50 pl-9 pr-3 text-sm font-semibold outline-none focus:border-trust focus:bg-white" />
                </label>
                <select aria-label="진료과 필터" value={filters.specialty} onChange={(event) => setFilters((current) => ({ ...current, specialty: event.target.value as typeof current.specialty }))} className="h-11 rounded-xl border border-line bg-white px-3 text-sm font-semibold outline-none focus:border-trust">
                  <option value="">전체 진료과</option>
                  {slots.map((slot) => <option key={slot.specialty} value={slot.specialty}>{slot.label}</option>)}
                </select>
                <select aria-label="자산 유형 필터" value={filters.assetType} onChange={(event) => setFilters((current) => ({ ...current, assetType: event.target.value as typeof current.assetType }))} className="h-11 rounded-xl border border-line bg-white px-3 text-sm font-semibold outline-none focus:border-trust">
                  <option value="">전체 자산</option>
                  {(Object.keys(assetLabels) as DatasetAssetType[]).map((type) => <option key={type} value={type}>{assetLabels[type]}</option>)}
                </select>
              </div>

              <div className="mt-4 max-h-[720px] space-y-2 overflow-y-auto pr-1">
                {filteredCandidates.slice(0, 150).map((candidate) => (
                  <article key={candidate.key} className="rounded-xl border border-line px-4 py-4 transition hover:border-slate-300 hover:bg-slate-50/70">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-bold text-trust">{assetLabels[candidate.assetType]}</span>
                      <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${riskTone(candidate.riskLevel)}`}>{candidate.riskLevel || "미분류"}</span>
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-600">{candidate.scope === "global" ? "공통" : candidate.specialty ? specialtyLabels[candidate.specialty] : "진료과"}</span>
                    </div>
                    <p className="mt-3 font-bold leading-6 text-ink">{candidate.standardKo}</p>
                    <p className="mt-1 text-xs font-semibold text-slate-500">{candidate.sourceIds.join(" · ")} · {candidate.category || "미분류"}</p>
                    {candidate.requiredTerms.length ? <p className="mt-2 line-clamp-2 text-xs text-slate-600"><b>필수:</b> {candidate.requiredTerms.join(" · ")}</p> : null}
                    <p className="mt-2 text-xs font-bold text-amber-700">승격 보류 · {candidate.readinessReason}</p>
                  </article>
                ))}
                {filteredCandidates.length > 150 ? <p className="py-3 text-center text-xs font-semibold text-slate-500">성능을 위해 첫 150개만 표시합니다. 검색과 필터로 범위를 좁혀 주세요.</p> : null}
              </div>
            </div>

            <aside className="space-y-5">
              <section className="rounded-2xl bg-white p-5 shadow-soft">
                <h2 className="font-bold text-ink">공통 병합 후보</h2>
                <p className="mt-1 text-xs font-semibold text-slate-500">둘 이상의 진료과에서 같은 표준어가 발견된 항목</p>
                <div className="mt-4 space-y-2">
                  {result.mergeGroups.slice(0, 12).map((group) => (
                    <div key={group.key} className="rounded-xl bg-slate-50 px-4 py-3">
                      <p className="text-sm font-bold text-ink">{group.standardKo}</p>
                      <p className="mt-1 text-xs font-semibold text-slate-500">{group.specialties.map((specialty) => specialtyLabels[specialty]).join(" · ")} → global 검토</p>
                    </div>
                  ))}
                  {result.mergeGroups.length === 0 ? <p className="rounded-xl bg-slate-50 px-4 py-5 text-center text-sm font-semibold text-slate-500">공통 병합 후보가 없습니다.</p> : null}
                </div>
              </section>

              <section className="rounded-2xl bg-white p-5 shadow-soft">
                <h2 className="font-bold text-ink">검수 메시지</h2>
                <div className="mt-4 space-y-2">
                  {result.issues.slice(0, 20).map((issue) => {
                    const tone = issueTone(issue.severity);
                    const Icon = tone.icon;
                    return (
                      <div key={issue.id} className={`rounded-xl border px-4 py-3 ${tone.box}`}>
                        <div className="flex items-start gap-2.5">
                          <Icon className={`mt-0.5 shrink-0 ${tone.text}`} size={17} aria-hidden="true" />
                          <div>
                            <p className={`text-xs font-bold ${tone.text}`}>{tone.label}{issue.specialty ? ` · ${specialtyLabels[issue.specialty]}` : ""}</p>
                            <p className="mt-1 text-sm font-semibold leading-5 text-slate-700">{issue.message}</p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {result.issues.length === 0 ? <p className="rounded-xl bg-emerald-50 px-4 py-5 text-center text-sm font-bold text-emerald-700">추가 검수 메시지가 없습니다.</p> : null}
                </div>
              </section>
            </aside>
          </section>
        </>
      ) : null}

      <Link href="/admin/glossary" className="inline-flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm font-bold text-slate-600 hover:bg-white hover:text-ink">
        <ArrowLeft size={17} aria-hidden="true" /> 품질 자산으로 돌아가기
      </Link>
    </div>
  );
}
