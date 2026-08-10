"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { AdminLoadingSkeleton } from "@/components/AdminLoadingSkeleton";
import { Loader2, Plus, RefreshCw, Save, Search } from "lucide-react";
import { languageLabels, patientLanguages } from "@/lib/languages";

type QuickPhraseStage = "intake" | "medical" | "procedure" | "price_schedule" | "summary";

type HospitalOption = {
  id: string;
  name: string;
  slug: string;
};

type QuickPhrase = {
  id: string;
  hospitalId: string;
  hospital?: { id: string; name: string; slug: string } | null;
  stage: QuickPhraseStage | null;
  ko: string;
  translations: Record<string, string>;
  sortOrder: number;
  isActive: boolean;
  updatedAt: string;
};

type Draft = {
  hospitalId: string;
  stage: QuickPhraseStage | "";
  ko: string;
  translations: Record<string, string>;
  sortOrder: number;
  isActive: boolean;
};

const stages = ["intake", "medical", "procedure", "price_schedule", "summary"] as const;

const stageLabels: Record<QuickPhraseStage | "", string> = {
  "": "Any stage",
  intake: "Intake",
  medical: "Medical",
  procedure: "Procedure",
  price_schedule: "Price / schedule",
  summary: "Summary"
};

const initialDraft: Draft = {
  hospitalId: "",
  stage: "",
  ko: "",
  translations: {},
  sortOrder: 100,
  isActive: true
};

function draftFromPhrase(phrase: QuickPhrase): Draft {
  return {
    hospitalId: phrase.hospitalId,
    stage: phrase.stage ?? "",
    ko: phrase.ko,
    translations: phrase.translations ?? {},
    sortOrder: phrase.sortOrder,
    isActive: phrase.isActive
  };
}

function payloadFromDraft(draft: Draft) {
  return {
    hospitalId: draft.hospitalId || undefined,
    stage: draft.stage || null,
    ko: draft.ko,
    translations: draft.translations,
    sortOrder: draft.sortOrder,
    isActive: draft.isActive
  };
}

export function AdminQuickPhraseManager() {
  const [phrases, setPhrases] = useState<QuickPhrase[]>([]);
  const [hospitals, setHospitals] = useState<HospitalOption[]>([]);
  const [edits, setEdits] = useState<Record<string, Draft>>({});
  const [draft, setDraft] = useState<Draft>(initialDraft);
  const [filters, setFilters] = useState({ q: "", hospitalId: "", stage: "" });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    if (filters.hospitalId) params.set("hospitalId", filters.hospitalId);
    if (filters.stage) params.set("stage", filters.stage);
    return params.toString();
  }, [filters.hospitalId, filters.stage]);

  const filteredPhrases = useMemo(() => {
    const q = filters.q.trim().toLowerCase();
    if (!q) return phrases;
    return phrases.filter((phrase) => {
      const haystack = [
        phrase.ko,
        phrase.hospital?.name ?? "",
        phrase.stage ? stageLabels[phrase.stage] : stageLabels[""],
        ...Object.values(phrase.translations ?? {})
      ].join(" ").toLowerCase();
      return haystack.includes(q);
    });
  }, [filters.q, phrases]);

  async function loadPhrases() {
    setLoading(true);
    setError("");
    const response = await fetch(`/api/admin/quick-phrases${queryString ? `?${queryString}` : ""}`, { cache: "no-store" });
    setLoading(false);
    if (!response.ok) {
      setError("Quick phrases could not be loaded.");
      return;
    }

    const data = await response.json();
    const nextPhrases = (data.phrases ?? []) as QuickPhrase[];
    const nextHospitals = (data.hospitals ?? []) as HospitalOption[];
    setPhrases(nextPhrases);
    setHospitals(nextHospitals);
    setEdits(Object.fromEntries(nextPhrases.map((phrase) => [phrase.id, draftFromPhrase(phrase)])));
    setDraft((current) => ({
      ...current,
      hospitalId: current.hospitalId || nextHospitals[0]?.id || ""
    }));
  }

  useEffect(() => {
    void loadPhrases();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryString]);

  function updateDraft<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function updateEdit<K extends keyof Draft>(phraseId: string, key: K, value: Draft[K]) {
    setEdits((current) => ({
      ...current,
      [phraseId]: { ...current[phraseId], [key]: value }
    }));
  }

  function updateTranslation(target: "new" | string, key: string, value: string) {
    if (target === "new") {
      setDraft((current) => ({
        ...current,
        translations: { ...current.translations, [key]: value }
      }));
      return;
    }

    setEdits((current) => ({
      ...current,
      [target]: {
        ...current[target],
        translations: { ...current[target]?.translations, [key]: value }
      }
    }));
  }

  async function createPhrase(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    const response = await fetch("/api/admin/quick-phrases", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payloadFromDraft(draft))
    });
    setBusy(false);

    if (!response.ok) {
      const data = await response.json().catch(() => null);
      setError(data?.error ?? "Quick phrase could not be created.");
      return;
    }

    setNotice("Quick phrase created.");
    setDraft({ ...initialDraft, hospitalId: draft.hospitalId });
    await loadPhrases();
  }

  async function savePhrase(phraseId: string) {
    const edit = edits[phraseId];
    if (!edit) return;
    setBusy(true);
    setError("");
    setNotice("");
    const response = await fetch(`/api/admin/quick-phrases/${phraseId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payloadFromDraft(edit))
    });
    setBusy(false);

    if (!response.ok) {
      const data = await response.json().catch(() => null);
      setError(data?.error ?? "Quick phrase could not be saved.");
      return;
    }

    setNotice("Quick phrase saved.");
    await loadPhrases();
  }

  async function toggleActive(phrase: QuickPhrase) {
    const edit = edits[phrase.id] ?? draftFromPhrase(phrase);
    setEdits((current) => ({ ...current, [phrase.id]: { ...edit, isActive: !edit.isActive } }));
    const response = await fetch(`/api/admin/quick-phrases/${phrase.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !edit.isActive })
    });
    if (!response.ok) {
      setError("Quick phrase status could not be changed.");
      await loadPhrases();
      return;
    }
    await loadPhrases();
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-bold text-trust-text">Quick Phrases</p>
          <h1 className="mt-1 text-[30px] font-bold leading-tight text-ink">Reusable Staff Phrases</h1>
        </div>
        <button type="button" onClick={() => void loadPhrases()} className="inline-flex h-11 items-center gap-2 rounded-lg bg-white px-4 text-sm font-bold text-ink shadow-sm">
          <RefreshCw size={17} />
          Refresh
        </button>
      </header>

      <section className="rounded-lg bg-white p-5 shadow-soft">
        <div className="grid gap-3 lg:grid-cols-[1.5fr_1fr_1fr_auto]">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
            <input
              className="h-11 w-full rounded-lg border border-line bg-slate-50 pl-9 pr-3 text-sm font-semibold outline-none focus:border-trust focus:bg-white"
              value={filters.q}
              onChange={(event) => setFilters((current) => ({ ...current, q: event.target.value }))}
              placeholder="Search"
            />
          </label>
          {hospitals.length ? (
            <Select
              value={filters.hospitalId}
              onChange={(value) => setFilters((current) => ({ ...current, hospitalId: value }))}
              options={[["", "All hospitals"], ...hospitals.map((hospital) => [hospital.id, hospital.name] as [string, string])]}
            />
          ) : null}
          <Select
            value={filters.stage}
            onChange={(value) => setFilters((current) => ({ ...current, stage: value }))}
            options={[["", "All stages"], ...stages.map((stage) => [stage, stageLabels[stage]] as [string, string])]}
          />
          <button type="button" onClick={() => setFilters({ q: "", hospitalId: "", stage: "" })} className="h-11 rounded-lg bg-slate-100 px-4 text-sm font-bold text-ink">
            Reset
          </button>
        </div>
      </section>

      <form onSubmit={createPhrase} className="rounded-lg bg-white p-5 shadow-soft">
        <div className="flex items-center gap-2">
          <Plus size={19} className="text-trust-text" />
          <h2 className="text-lg font-bold text-ink">New Phrase</h2>
        </div>
        <QuickPhraseFields
          draft={draft}
          hospitals={hospitals}
          onChange={updateDraft}
          onTranslationChange={(key, value) => updateTranslation("new", key, value)}
        />
        <p className="mt-3 text-xs font-semibold text-slate-500">Blank translations are generated and cached when saved.</p>
        <button disabled={busy || !draft.ko.trim()} className="mt-4 inline-flex h-11 items-center gap-2 rounded-lg bg-trust px-4 text-sm font-bold text-white disabled:opacity-50">
          {busy ? <Loader2 size={17} className="animate-spin" /> : <Save size={17} />}
          Create
        </button>
      </form>

      {error ? <p className="rounded-lg bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</p> : null}
      {notice ? <p className="rounded-lg bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">{notice}</p> : null}

      <section className="overflow-x-auto rounded-lg bg-white shadow-soft">
        <table className="w-full min-w-[1280px] border-collapse text-left text-sm">
          <thead className="bg-slate-50 text-xs font-bold uppercase text-slate-500">
            <tr>
              <th className="px-4 py-4">Phrase</th>
              <th className="px-4 py-4">Scope</th>
              <th className="px-4 py-4">Translations</th>
              <th className="px-4 py-4">Status</th>
              <th className="px-4 py-4">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="p-0"><AdminLoadingSkeleton rows={3} /></td>
              </tr>
            ) : filteredPhrases.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-0"><AdminLoadingSkeleton rows={3} /></td>
              </tr>
            ) : (
              filteredPhrases.map((phrase) => {
                const edit = edits[phrase.id] ?? draftFromPhrase(phrase);
                return (
                  <tr key={phrase.id} className="border-t border-line align-top">
                    <td className="w-[330px] px-4 py-4">
                      <textarea
                        className="min-h-24 w-full resize-y rounded-lg border border-line bg-slate-50 px-3 py-2 text-sm font-semibold leading-6 outline-none focus:border-trust focus:bg-white"
                        value={edit.ko}
                        onChange={(event) => updateEdit(phrase.id, "ko", event.target.value)}
                      />
                    </td>
                    <td className="w-[240px] px-4 py-4">
                      <div className="grid gap-2">
                        {hospitals.length ? (
                          <Select
                            value={edit.hospitalId}
                            onChange={(value) => updateEdit(phrase.id, "hospitalId", value)}
                            options={hospitals.map((hospital) => [hospital.id, hospital.name] as [string, string])}
                          />
                        ) : (
                          <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm font-bold text-slate-600">{phrase.hospital?.name ?? "Hospital"}</p>
                        )}
                        <Select
                          value={edit.stage}
                          onChange={(value) => updateEdit(phrase.id, "stage", value as Draft["stage"])}
                          options={[["", stageLabels[""]], ...stages.map((stage) => [stage, stageLabels[stage]] as [string, string])]}
                        />
                        <input
                          className="h-10 w-full rounded-lg border border-line bg-slate-50 px-3 text-sm font-semibold outline-none focus:border-trust focus:bg-white"
                          type="number"
                          value={edit.sortOrder}
                          onChange={(event) => updateEdit(phrase.id, "sortOrder", Number(event.target.value))}
                        />
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <TranslationGrid translations={edit.translations} onChange={(key, value) => updateTranslation(phrase.id, key, value)} compact />
                    </td>
                    <td className="w-[110px] px-4 py-4">
                      <button type="button" onClick={() => void toggleActive(phrase)} className={`h-10 rounded-lg px-3 text-sm font-bold ${edit.isActive ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                        {edit.isActive ? "Active" : "Inactive"}
                      </button>
                    </td>
                    <td className="w-[120px] px-4 py-4">
                      <button type="button" onClick={() => void savePhrase(phrase.id)} disabled={busy || !edit.ko.trim()} className="inline-flex h-10 items-center gap-2 rounded-lg bg-trust px-3 text-sm font-bold text-white disabled:opacity-50">
                        <Save size={16} />
                        Save
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function QuickPhraseFields({
  draft,
  hospitals,
  onChange,
  onTranslationChange
}: {
  draft: Draft;
  hospitals: HospitalOption[];
  onChange: <K extends keyof Draft>(key: K, value: Draft[K]) => void;
  onTranslationChange: (key: string, value: string) => void;
}) {
  return (
    <div className="mt-4 space-y-4">
      <div className="grid gap-3 md:grid-cols-[1fr_1fr_120px_120px]">
        {hospitals.length ? (
          <Select
            value={draft.hospitalId}
            onChange={(value) => onChange("hospitalId", value)}
            options={hospitals.map((hospital) => [hospital.id, hospital.name] as [string, string])}
          />
        ) : null}
        <Select
          value={draft.stage}
          onChange={(value) => onChange("stage", value as Draft["stage"])}
          options={[["", stageLabels[""]], ...stages.map((stage) => [stage, stageLabels[stage]] as [string, string])]}
        />
        <input
          className="h-10 w-full rounded-lg border border-line bg-slate-50 px-3 text-sm font-semibold outline-none focus:border-trust focus:bg-white"
          type="number"
          value={draft.sortOrder}
          onChange={(event) => onChange("sortOrder", Number(event.target.value))}
        />
        <button
          type="button"
          onClick={() => onChange("isActive", !draft.isActive)}
          className={`h-10 rounded-lg px-3 text-sm font-bold ${draft.isActive ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}
        >
          {draft.isActive ? "Active" : "Inactive"}
        </button>
      </div>
      <textarea
        className="min-h-24 w-full resize-y rounded-lg border border-line bg-slate-50 px-3 py-2 text-sm font-semibold leading-6 outline-none focus:border-trust focus:bg-white"
        value={draft.ko}
        onChange={(event) => onChange("ko", event.target.value)}
        placeholder="Korean staff phrase"
      />
      <TranslationGrid translations={draft.translations} onChange={onTranslationChange} />
    </div>
  );
}

function TranslationGrid({
  translations,
  onChange,
  compact = false
}: {
  translations: Record<string, string>;
  onChange: (key: string, value: string) => void;
  compact?: boolean;
}) {
  return (
    <div className={`grid gap-2 ${compact ? "grid-cols-2" : "sm:grid-cols-2 lg:grid-cols-4"}`}>
      {patientLanguages.map((language) => (
        <label key={language} className="block">
          <span className="text-[11px] font-bold text-slate-500">{languageLabels[language].english}</span>
          <input
            className="mt-1 h-9 w-full rounded-lg border border-line bg-slate-50 px-2 text-xs font-semibold outline-none focus:border-trust focus:bg-white"
            value={translations[language] ?? ""}
            onChange={(event) => onChange(language, event.target.value)}
          />
        </label>
      ))}
    </div>
  );
}

function Select({ value, onChange, options }: { value: string; onChange: (value: string) => void; options: Array<[string, string]> }) {
  return (
    <select className="h-10 w-full rounded-lg border border-line bg-slate-50 px-3 text-sm font-semibold outline-none focus:border-trust focus:bg-white" value={value} onChange={(event) => onChange(event.target.value)}>
      {options.map(([optionValue, label]) => (
        <option key={optionValue} value={optionValue}>
          {label}
        </option>
      ))}
    </select>
  );
}
