"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AdminLoadingSkeleton } from "@/components/AdminLoadingSkeleton";
import styles from "./AdminGlossaryShell.module.css";
import { Archive, BookOpenCheck, ChevronDown, Download, Eye, FileUp, GitBranch, Loader2, PencilLine, Plus, Rocket, RotateCcw, Save, Search, ShieldCheck, Sparkles, X } from "lucide-react";
import { AdminQualityWorkspaceNav } from "@/components/AdminQualityWorkspaceNav";
import { hospitalSpecialties, hospitalSpecialtyLabels, type HospitalSpecialty } from "@/lib/hospital-specialty";

type Scope = "global" | "specialty" | "hospital";
type EntryType = "term" | "critical_phrase" | "transcription_hint" | "verified_sentence";
type Lifecycle = "draft" | "approved" | "active" | "retired";
type LifecycleAction = "approve" | "activate" | "new_version" | "retire" | "rollback";
type Hospital = { id: string; name: string; slug: string; specialty: HospitalSpecialty };
type Entry = { id: string; scope: Scope; specialty?: HospitalSpecialty | null; hospitalId?: string | null; hospital?: { id: string; name: string; slug: string } | null; entryType: EntryType; spokenForms: string[]; standardKo: string; translations: Record<string, string>; category?: string | null; note?: string | null; priority: number; isActive: boolean; lineageId: string; version: number; lifecycle: Lifecycle };
type Draft = { scope: Scope; specialty: HospitalSpecialty | ""; hospitalId: string; entryType: EntryType; spokenFormsText: string; standardKo: string; translations: Record<string, string>; category: string; note: string; priority: number; isActive: boolean };
type Preview = { hospital: Hospital; prompt: string; chars: number; hintCount: number; mappingCount: number; truncated: boolean; conflicts: Array<{ spokenForm: string; standardForms: string[] }> };

const languageKeys = ["zh", "zh_tw", "yue", "ja", "en", "ru", "vi", "id", "th", "ms", "tl", "mn", "fr", "es", "de", "it", "pt"] as const;
const languageLabels: Record<(typeof languageKeys)[number], string> = { zh: "중국어(간체)", zh_tw: "중국어(번체)", yue: "광둥어", ja: "일본어", en: "영어", ru: "러시아어", vi: "베트남어", id: "인도네시아어", th: "태국어", ms: "말레이어", tl: "타갈로그어", mn: "몽골어", fr: "프랑스어", es: "스페인어", de: "독일어", it: "이탈리아어", pt: "포르투갈어" };
const typeLabels: Record<EntryType, string> = { transcription_hint: "STT 힌트", term: "의료 용어", verified_sentence: "검증 문장", critical_phrase: "필수 표현" };
const scopeLabels: Record<Scope, string> = { hospital: "병원 전용", specialty: "진료과 공통", global: "전체 공통" };
const lifecycleLabels: Record<Lifecycle, string> = { draft: "초안", approved: "승인됨", active: "배포 중", retired: "이전 버전" };
const lifecycleActionCopy: Record<LifecycleAction, { title: string; body: string; confirm: string }> = { approve: { title: "이 버전을 승인할까요?", body: "검토 완료 상태로 바뀌지만 아직 운영 번역에는 적용되지 않습니다.", confirm: "승인 기록" }, activate: { title: "이 버전을 배포할까요?", body: "활성화 즉시 다음 음성 인식과 번역부터 이 자산이 적용됩니다.", confirm: "운영에 배포" }, new_version: { title: "새 버전을 만들까요?", body: "현재 운영 버전은 유지되고 수정용 초안이 별도로 생성됩니다.", confirm: "새 초안 만들기" }, retire: { title: "배포를 중지할까요?", body: "다음 요청부터 이 자산이 운영 번역에 사용되지 않습니다.", confirm: "배포 중지" }, rollback: { title: "이 버전으로 롤백할까요?", body: "현재 활성 버전을 대신해 선택한 이전 버전이 다음 요청부터 적용됩니다.", confirm: "이 버전으로 롤백" } };
const emptyDraft: Draft = { scope: "hospital", specialty: "", hospitalId: "", entryType: "term", spokenFormsText: "", standardKo: "", translations: {}, category: "", note: "", priority: 100, isActive: true };

function fromEntry(entry: Entry): Draft { return { scope: entry.scope, specialty: entry.specialty ?? "", hospitalId: entry.hospitalId ?? "", entryType: entry.entryType, spokenFormsText: entry.spokenForms.join(" | "), standardKo: entry.standardKo, translations: entry.translations ?? {}, category: entry.category ?? "", note: entry.note ?? "", priority: entry.priority, isActive: entry.isActive }; }
function payload(draft: Draft) { return { scope: draft.scope, specialty: draft.specialty || null, hospitalId: draft.hospitalId || null, entryType: draft.entryType, spokenForms: draft.spokenFormsText.split("|").map((value) => value.trim()).filter(Boolean), standardKo: draft.standardKo.trim(), translations: draft.translations, category: draft.category.trim() || null, note: draft.note.trim() || null, priority: draft.priority, isActive: draft.isActive }; }
function coverage(entry: Entry) { return languageKeys.filter((key) => entry.translations?.[key]?.trim()).length; }

export function AdminGlossaryLibrary() {
  const fileInput = useRef<HTMLInputElement | null>(null);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [filters, setFilters] = useState({ q: "", scope: "", entryType: "" });
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [pendingLifecycle, setPendingLifecycle] = useState<{ entry: Entry; action: LifecycleAction } | null>(null);

  const query = useMemo(() => { const params = new URLSearchParams(); if (filters.q.trim()) params.set("q", filters.q.trim()); if (filters.scope) params.set("scope", filters.scope); if (filters.entryType) params.set("entryType", filters.entryType); return params.toString(); }, [filters]);
  const stats = useMemo(() => ({ total: entries.length, active: entries.filter((entry) => entry.lifecycle === "active").length, drafts: entries.filter((entry) => entry.lifecycle === "draft").length, verified: entries.filter((entry) => entry.entryType === "verified_sentence").length }), [entries]);

  async function loadEntries() {
    setLoading(true); setError("");
    const response = await fetch(`/api/admin/glossary${query ? `?${query}` : ""}`, { cache: "no-store" });
    setLoading(false);
    if (!response.ok) { setError("품질 자산을 불러오지 못했습니다."); return; }
    const data = await response.json();
    const nextHospitals = (data.hospitals ?? []) as Hospital[];
    setEntries((data.entries ?? []) as Entry[]); setHospitals(nextHospitals);
    setDraft((current) => current.hospitalId ? current : { ...current, hospitalId: nextHospitals[0]?.id || "" });
  }
  // The request function is intentionally recreated; query is the only reload trigger.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { const timer = window.setTimeout(() => void loadEntries(), 180); return () => window.clearTimeout(timer); }, [query]);

  function startCreate() { setDraft({ ...emptyDraft, hospitalId: hospitals[0]?.id || "" }); setEditingId(null); setShowEditor(true); setNotice(""); setError(""); }
  function startEdit(entry: Entry) { setDraft(fromEntry(entry)); setEditingId(entry.id); setShowEditor(true); setNotice(""); setError(""); }
  async function saveDraft() {
    if (!draft.standardKo.trim()) { setError("기준 한국어를 입력해 주세요."); return; }
    if (draft.scope === "hospital" && !draft.hospitalId) { setError("적용 병원을 선택해 주세요."); return; }
    setBusy(true); setError(""); setNotice("");
    const response = await fetch(editingId ? `/api/admin/glossary/${editingId}` : "/api/admin/glossary", { method: editingId ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload(draft)) });
    setBusy(false);
    if (!response.ok) { const data = await response.json().catch(() => ({})); setError(data.error || "품질 자산을 저장하지 못했습니다."); return; }
    setNotice(editingId ? "품질 자산을 수정했습니다." : "새 품질 자산을 만들었습니다."); setShowEditor(false); setEditingId(null); await loadEntries();
  }
  async function lifecycleAction(entry: Entry, action: LifecycleAction) {
    setBusy(true); setError(""); setNotice("");
    const response = await fetch(`/api/admin/glossary/${entry.id}/lifecycle`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) });
    const data = await response.json().catch(() => ({}));
    setBusy(false);
    if (!response.ok) { setError(data.error || "버전 상태를 변경하지 못했습니다."); return; }
    const actionNotice = { approve: "검토 승인을 기록했습니다.", activate: "승인 버전을 배포했습니다.", new_version: "수정할 새 초안을 만들었습니다.", retire: "배포를 중지했습니다.", rollback: "선택한 버전으로 롤백했습니다." };
    setNotice(actionNotice[action]);
    setPendingLifecycle(null);
    await loadEntries();
  }
  async function loadPreview() {
    setBusy(true); setError(""); const hospitalId = hospitals[0]?.id; const params = new URLSearchParams(); if (hospitalId) params.set("hospitalId", hospitalId);
    const response = await fetch(`/api/admin/glossary/preview${params.size ? `?${params}` : ""}`, { cache: "no-store" }); setBusy(false);
    if (!response.ok) { setError("STT 적용 미리보기를 불러오지 못했습니다."); return; } setPreview(await response.json()); setShowPreview(true);
  }
  async function importCsv(file: File | undefined) {
    if (!file) return; setBusy(true); setError("");
    const response = await fetch("/api/admin/glossary?format=csv", { method: "POST", headers: { "Content-Type": "text/csv; charset=utf-8" }, body: await file.text() }); setBusy(false);
    if (!response.ok) { const data = await response.json().catch(() => ({})); setError(data.error || "CSV를 가져오지 못했습니다."); return; }
    const data = await response.json(); setNotice(`${data.imported ?? 0}개 행을 반영했습니다.`); await loadEntries();
  }

  return <div className={`${styles.root} space-y-5 pb-10`}>
    <AdminQualityWorkspaceNav active="glossary" />
    <section className="rounded-[24px] border border-line bg-white px-5 py-6 shadow-soft sm:px-7">
      <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
        <div><p className="flex items-center gap-2 text-sm font-semibold text-mint-text"><Sparkles className="h-4 w-4" /> 지속 학습 품질 자산</p><h1 className="mt-2 text-2xl font-bold tracking-[-0.03em] sm:text-3xl">품질 자산 라이브러리</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">검수에서 승인한 표현을 STT, 의료 용어, 검증 문장으로 관리합니다. 활성 자산은 다음 음성 인식과 번역에 재사용됩니다.</p></div>
        <div className="flex flex-wrap gap-2"><input ref={fileInput} type="file" accept=".csv,text/csv" className="hidden" onChange={(event) => void importCsv(event.target.files?.[0])} /><button type="button" onClick={() => fileInput.current?.click()} className="secondary-button"><FileUp className="h-4 w-4" /> CSV 가져오기</button><button type="button" onClick={() => { window.location.href = `/api/admin/glossary?${query ? `${query}&` : ""}format=csv`; }} className="secondary-button"><Download className="h-4 w-4" /> 내보내기</button><button type="button" onClick={startCreate} className="primary-button"><Plus className="h-4 w-4" /> 새 품질 자산</button></div>
      </div>
      <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Metric label="전체 버전" value={stats.total} icon={<BookOpenCheck className="h-5 w-5 text-trust-text" />} /><Metric label="배포 중" value={stats.active} icon={<Rocket className="h-5 w-5 text-mint-text" />} /><Metric label="승인 대기 초안" value={stats.drafts} icon={<GitBranch className="h-5 w-5 text-violet-500" />} /><Metric label="검증 문장" value={stats.verified} icon={<BookOpenCheck className="h-5 w-5 text-amber-500" />} /></div>
    </section>

    {showEditor ? <Editor draft={draft} title={editingId ? "품질 자산 수정" : "새 품질 자산 만들기"} hospitals={hospitals} busy={busy} onChange={setDraft} onClose={() => setShowEditor(false)} onSave={() => void saveDraft()} /> : null}

    <section className="overflow-hidden rounded-[24px] border border-line bg-white shadow-soft">
      <div className="border-b border-line px-5 py-5 sm:px-7"><div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between"><div className="relative min-w-0 flex-1 lg:max-w-md"><Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input value={filters.q} onChange={(event) => setFilters((current) => ({ ...current, q: event.target.value }))} placeholder="기준어 또는 발음 변형 검색" className="field pl-10" /></div><div className="flex flex-wrap gap-2"><Select value={filters.entryType} onChange={(value) => setFilters((current) => ({ ...current, entryType: value }))} options={[["", "전체 유형"], ...Object.entries(typeLabels)]} compact /><Select value={filters.scope} onChange={(value) => setFilters((current) => ({ ...current, scope: value }))} options={[["", "전체 범위"], ...Object.entries(scopeLabels)]} compact /><button type="button" onClick={() => void loadPreview()} className="secondary-button"><Eye className="h-4 w-4" /> STT 적용 미리보기</button></div></div></div>
      {notice ? <p className="border-b border-emerald-100 bg-emerald-50 px-6 py-3 text-sm font-semibold text-emerald-700">{notice}</p> : null}{error ? <p className="border-b border-red-100 bg-red-50 px-6 py-3 text-sm font-semibold text-red-700">{error}</p> : null}
      <div className="hidden grid-cols-[minmax(260px,1.5fr)_120px_150px_100px_minmax(260px,1fr)] gap-4 border-b border-line bg-slate-50 px-7 py-3 text-xs font-bold text-muted lg:grid"><span>품질 자산</span><span>유형</span><span>적용 범위</span><span>버전 상태</span><span>검토·배포 관리</span></div>
      {loading ? <AdminLoadingSkeleton rows={4} /> : entries.length === 0 ? <div className="px-6 py-16 text-center"><BookOpenCheck className="mx-auto h-9 w-9 text-slate-300" /><p className="mt-3 font-semibold">조건에 맞는 품질 자산이 없습니다.</p><p className="mt-1 text-sm text-slate-500">검수 대기함에서 승인하거나 새 자산을 추가해 보세요.</p></div> : <div className="divide-y divide-line">{entries.map((entry) => <GlossaryEntryRow key={entry.id} entry={entry} busy={busy} onEdit={startEdit} onLifecycle={(entry, action) => setPendingLifecycle({ entry, action })} />)}</div>}
    </section>

    {pendingLifecycle ? <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/45 p-4 sm:items-center"><section role="alertdialog" aria-modal="true" aria-labelledby="lifecycle-title" className="w-full max-w-md rounded-lg bg-white p-5 shadow-soft"><h2 id="lifecycle-title" className="text-xl font-bold text-ink">{lifecycleActionCopy[pendingLifecycle.action].title}</h2><p className="mt-2 text-sm font-semibold leading-6 text-slate-600">{lifecycleActionCopy[pendingLifecycle.action].body}</p><div className="mt-3 rounded-lg bg-slate-50 px-4 py-3"><p className="break-words font-bold text-ink">{pendingLifecycle.entry.standardKo}</p><p className="mt-1 text-xs font-bold text-slate-500">v{pendingLifecycle.entry.version} · {lifecycleLabels[pendingLifecycle.entry.lifecycle]}</p></div><div className="mt-5 grid gap-2 sm:grid-cols-2"><button type="button" autoFocus disabled={busy} onClick={() => setPendingLifecycle(null)} className="min-h-12 rounded-lg border border-line bg-white font-bold text-ink">취소</button><button type="button" disabled={busy} onClick={() => void lifecycleAction(pendingLifecycle.entry, pendingLifecycle.action)} className="min-h-12 rounded-lg bg-ink px-4 font-bold text-white disabled:opacity-50">{busy ? "처리 중" : lifecycleActionCopy[pendingLifecycle.action].confirm}</button></div></section></div> : null}

    {showPreview ? <section className="rounded-[24px] border border-violet-200 bg-violet-50/60 p-5 sm:p-7"><div className="flex items-start justify-between gap-4"><div><p className="text-sm font-bold text-violet-700">실제 STT 프롬프트 적용 결과</p><h2 className="mt-1 text-xl font-bold">{preview?.hospital.name ?? "병원"} 음성 인식 힌트</h2></div><button type="button" onClick={() => setShowPreview(false)} className="rounded-lg p-2 hover:bg-white" aria-label="미리보기 닫기"><X className="h-5 w-5" /></button></div>{preview ? <><div className="mt-4 flex flex-wrap gap-2"><Badge tone="violet">힌트 {preview.hintCount}개</Badge><Badge tone="blue">매핑 {preview.mappingCount}개</Badge><Badge tone={preview.conflicts.length ? "red" : "mint"}>충돌 {preview.conflicts.length}개</Badge><Badge tone={preview.truncated ? "amber" : "mint"}>{preview.chars}자 · {preview.truncated ? "일부 생략" : "전체 적용"}</Badge></div><pre className="mt-4 max-h-72 overflow-auto whitespace-pre-wrap rounded-2xl border border-violet-100 bg-white p-4 text-xs leading-6 text-slate-600">{preview.prompt}</pre></> : null}</section> : null}
  </div>;
}

function GlossaryEntryRow({ entry, busy, onEdit, onLifecycle }: {
  entry: Entry;
  busy: boolean;
  onEdit: (entry: Entry) => void;
  onLifecycle: (entry: Entry, action: LifecycleAction) => void;
}) {
  const tone = entry.lifecycle === "active" ? "mint" : entry.lifecycle === "approved" ? "blue" : entry.lifecycle === "draft" ? "amber" : "violet";
  const scope = entry.scope === "hospital" ? entry.hospital?.name || scopeLabels[entry.scope] : entry.scope === "specialty" && entry.specialty ? hospitalSpecialtyLabels[entry.specialty] : scopeLabels[entry.scope];
  return <article className="grid gap-4 px-5 py-5 transition hover:bg-slate-50/70 sm:px-7 lg:grid-cols-[minmax(260px,1.5fr)_120px_150px_100px_minmax(260px,1fr)] lg:items-center">
    <div className="min-w-0"><p className="truncate font-bold tracking-[-0.01em]">{entry.standardKo}</p><p className="mt-1 truncate text-xs text-slate-500">{entry.spokenForms.length ? `발음 변형: ${entry.spokenForms.join(" · ")}` : "발음 변형 없음"}{entry.category ? ` · ${entry.category}` : ""} · 번역 {coverage(entry)}/17</p></div>
    <div><Badge tone={entry.entryType === "transcription_hint" ? "violet" : entry.entryType === "verified_sentence" ? "amber" : "blue"}>{typeLabels[entry.entryType]}</Badge></div>
    <div className="text-sm font-semibold text-slate-600">{scope}</div>
    <div className="space-y-1"><Badge tone={tone}>{lifecycleLabels[entry.lifecycle]}</Badge><p className="text-xs font-bold text-muted">v{entry.version}</p></div>
    <div className="flex flex-wrap gap-2">
      {entry.lifecycle === "draft" ? <><button type="button" disabled={busy} onClick={() => onEdit(entry)} className="secondary-button min-h-11 px-3"><PencilLine className="h-4 w-4" /> 수정</button><button type="button" disabled={busy} onClick={() => void onLifecycle(entry, "approve")} className="secondary-button min-h-11 px-3"><ShieldCheck className="h-4 w-4" /> 승인</button></> : null}
      {entry.lifecycle === "approved" ? <button type="button" disabled={busy} onClick={() => void onLifecycle(entry, "activate")} className="primary-button min-h-11 px-3"><Rocket className="h-4 w-4" /> 배포</button> : null}
      {entry.lifecycle === "active" ? <><button type="button" disabled={busy} onClick={() => void onLifecycle(entry, "new_version")} className="secondary-button min-h-11 px-3"><GitBranch className="h-4 w-4" /> 새 버전</button><button type="button" disabled={busy} onClick={() => void onLifecycle(entry, "retire")} className="secondary-button min-h-11 px-3"><Archive className="h-4 w-4" /> 중지</button></> : null}
      {entry.lifecycle === "retired" ? <button type="button" disabled={busy} onClick={() => void onLifecycle(entry, "rollback")} className="secondary-button min-h-11 px-3"><RotateCcw className="h-4 w-4" /> 이 버전으로 롤백</button> : null}
    </div>
  </article>;
}

function Editor({ draft, title, hospitals, busy, onChange, onClose, onSave }: { draft: Draft; title: string; hospitals: Hospital[]; busy: boolean; onChange: (draft: Draft) => void; onClose: () => void; onSave: () => void }) {
  function update<K extends keyof Draft>(key: K, value: Draft[K]) { onChange({ ...draft, [key]: value }); }
  return <section className="rounded-[24px] border border-blue-200 bg-white p-5 shadow-soft sm:p-7"><div className="flex items-center justify-between"><div><p className="text-sm font-semibold text-trust-text">검수 결과를 재사용 가능한 자산으로</p><h2 className="mt-1 text-xl font-bold">{title}</h2></div><button type="button" onClick={onClose} className="rounded-lg p-2 hover:bg-slate-100" aria-label="편집 닫기"><X className="h-5 w-5" /></button></div><div className="mt-6 grid gap-5 xl:grid-cols-[1.15fr_.85fr]"><div className="space-y-4"><Field label="기준 한국어" required><input value={draft.standardKo} onChange={(event) => update("standardKo", event.target.value)} className="field" placeholder="예: 필러 시술 후 붓기가 있을 수 있습니다." /></Field><Field label="발음 변형 · 오인식 별칭" hint="여러 개는 | 로 구분"><input value={draft.spokenFormsText} onChange={(event) => update("spokenFormsText", event.target.value)} className="field" placeholder="예: 필러 | 휠러" /></Field><div className="grid gap-4 sm:grid-cols-2"><Field label="자산 유형"><Select value={draft.entryType} onChange={(value) => update("entryType", value as EntryType)} options={Object.entries(typeLabels)} /></Field><Field label="적용 범위"><Select value={draft.scope} onChange={(value) => update("scope", value as Scope)} options={Object.entries(scopeLabels)} /></Field></div>{draft.scope === "hospital" ? <Field label="적용 병원"><Select value={draft.hospitalId} onChange={(value) => update("hospitalId", value)} options={[["", "병원 선택"], ...hospitals.map((hospital) => [hospital.id, hospital.name] as [string, string])]} /></Field> : null}{draft.scope === "specialty" ? <Field label="적용 진료과"><Select value={draft.specialty} onChange={(value) => update("specialty", value as HospitalSpecialty)} options={[["", "진료과 선택"], ...hospitalSpecialties.map((specialty) => [specialty, hospitalSpecialtyLabels[specialty]] as [string, string])]} /></Field> : null}<div className="grid gap-4 sm:grid-cols-2"><Field label="카테고리"><input value={draft.category} onChange={(event) => update("category", event.target.value)} className="field" /></Field><Field label="우선순위"><input type="number" min={0} max={100000} value={draft.priority} onChange={(event) => update("priority", Number(event.target.value))} className="field" /></Field></div><Field label="검수 메모"><textarea value={draft.note} onChange={(event) => update("note", event.target.value)} className="field min-h-24 py-3" /></Field></div><div className="rounded-2xl border border-line bg-slate-50 p-4 sm:p-5"><details open={Object.keys(draft.translations).length > 0}><summary className="flex cursor-pointer list-none items-center justify-between font-bold"><span>17개 언어 번역</span><span className="inline-flex items-center gap-1 text-xs text-slate-500">{languageKeys.filter((key) => draft.translations[key]?.trim()).length}/17 입력 <ChevronDown className="h-4 w-4" /></span></summary><p className="mt-2 text-xs leading-5 text-slate-500">필요한 언어부터 채우세요. 빈 언어는 일반 번역 처리로 돌아갑니다.</p><div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">{languageKeys.map((key) => <Field key={key} label={languageLabels[key]}><input value={draft.translations[key] ?? ""} onChange={(event) => update("translations", { ...draft.translations, [key]: event.target.value })} className="field bg-white" /></Field>)}</div></details></div></div><div className="mt-6 flex flex-col-reverse gap-3 border-t border-line pt-5 sm:flex-row sm:items-center sm:justify-between"><p className="text-sm font-semibold text-slate-500">저장 후 초안으로 등록됩니다. 검토 승인과 배포는 목록에서 별도로 진행합니다.</p><div className="flex gap-2"><button type="button" onClick={onClose} className="secondary-button">취소</button><button type="button" disabled={busy} onClick={onSave} className="primary-button">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} 초안 저장</button></div></div></section>;
}

function Metric({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) { return <div className="flex items-center gap-3 rounded-2xl border border-line bg-slate-50/70 p-4"><div className="rounded-xl bg-white p-2 shadow-sm">{icon}</div><div><p className="text-xs font-semibold text-slate-500">{label}</p><p className="mt-0.5 text-xl font-bold">{value.toLocaleString()}</p></div></div>; }
function Field({ label, hint, required, children }: { label: string; hint?: string; required?: boolean; children: React.ReactNode }) { return <label className="block"><span className="mb-1.5 flex items-center justify-between text-xs font-bold text-slate-600"><span>{label}{required ? <span className="ml-1 text-coral-text">*</span> : null}</span>{hint ? <span className="font-medium text-muted">{hint}</span> : null}</span>{children}</label>; }
function Select({ value, onChange, options, compact = false }: { value: string; onChange: (value: string) => void; options: Array<[string, string]>; compact?: boolean }) { return <select value={value} onChange={(event) => onChange(event.target.value)} className={compact ? "min-h-11 rounded-xl border border-line bg-white px-3 text-sm font-semibold outline-none focus:border-trust" : "field"}>{options.map(([optionValue, label]) => <option key={optionValue} value={optionValue}>{label}</option>)}</select>; }
function Badge({ children, tone }: { children: React.ReactNode; tone: "blue" | "mint" | "violet" | "amber" | "red" }) { const style = { blue: "bg-blue-50 text-blue-700", mint: "bg-emerald-50 text-emerald-700", violet: "bg-violet-50 text-violet-700", amber: "bg-amber-50 text-amber-700", red: "bg-red-50 text-red-700" }; return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${style[tone]}`}>{children}</span>; }
