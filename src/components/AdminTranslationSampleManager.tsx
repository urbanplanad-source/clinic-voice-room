"use client";

import { useEffect, useMemo, useState } from "react";
import { RefreshCw, Search } from "lucide-react";

type SampleSource = "local_voice" | "consultation_voice" | "procedure_voice";

type HospitalOption = {
  id: string;
  name: string;
  slug: string;
};

type TranslationSample = {
  id: string;
  hospitalId: string;
  hospital?: { id: string; name: string; slug: string } | null;
  staffId: string | null;
  staff?: { id: string; name: string; email: string } | null;
  roomId: string | null;
  messageId: string | null;
  source: SampleSource;
  mode: string;
  direction: string;
  patientLanguage: string | null;
  sourceText: string;
  translatedText: string;
  sourceLanguage: string;
  targetLanguage: string;
  model: string | null;
  createdAt: string;
};

const sources = ["local_voice", "consultation_voice", "procedure_voice"] as const;

const sourceLabels: Record<SampleSource, string> = {
  local_voice: "Face-to-face",
  consultation_voice: "Consultation",
  procedure_voice: "Procedure"
};

export function AdminTranslationSampleManager() {
  const [samples, setSamples] = useState<TranslationSample[]>([]);
  const [hospitals, setHospitals] = useState<HospitalOption[]>([]);
  const [filters, setFilters] = useState({ q: "", hospitalId: "", source: "" });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    if (filters.hospitalId) params.set("hospitalId", filters.hospitalId);
    if (filters.source) params.set("source", filters.source);
    return params.toString();
  }, [filters.hospitalId, filters.source]);

  const filteredSamples = useMemo(() => {
    const q = filters.q.trim().toLowerCase();
    if (!q) return samples;
    return samples.filter((item) => {
      const haystack = [
        item.hospital?.name ?? "",
        item.hospital?.slug ?? "",
        item.staff?.name ?? "",
        item.staff?.email ?? "",
        item.sourceText,
        item.translatedText,
        item.source,
        item.mode,
        item.direction,
        item.patientLanguage ?? "",
        item.sourceLanguage,
        item.targetLanguage,
        item.model ?? ""
      ].join(" ").toLowerCase();
      return haystack.includes(q);
    });
  }, [samples, filters.q]);

  async function loadSamples() {
    setLoading(true);
    setError("");
    const response = await fetch(`/api/admin/samples${queryString ? `?${queryString}` : ""}`, { cache: "no-store" });
    setLoading(false);
    if (!response.ok) {
      setError("Samples could not be loaded.");
      return;
    }

    const data = await response.json();
    setSamples((data.samples ?? []) as TranslationSample[]);
    setHospitals((data.hospitals ?? []) as HospitalOption[]);
  }

  useEffect(() => {
    void loadSamples();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryString]);

  const total = filteredSamples.length;

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-bold text-trust">Translation Samples</p>
          <h1 className="mt-1 text-[30px] font-bold leading-tight text-ink">Collected Voice Turns</h1>
        </div>
        <button type="button" onClick={() => void loadSamples()} className="inline-flex h-11 items-center gap-2 rounded-lg bg-white px-4 text-sm font-bold text-ink shadow-sm">
          <RefreshCw size={17} />
          Refresh
        </button>
      </header>

      <section className="grid gap-3 md:grid-cols-2">
        <SummaryStat label="Visible" value={total.toLocaleString()} />
        <SummaryStat label="Loaded" value={samples.length.toLocaleString()} />
      </section>

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
          <Select
            value={filters.source}
            onChange={(value) => setFilters((current) => ({ ...current, source: value }))}
            options={[["", "All sources"], ...sources.map((source) => [source, sourceLabels[source]] as [string, string])]}
          />
          {hospitals.length ? (
            <Select
              value={filters.hospitalId}
              onChange={(value) => setFilters((current) => ({ ...current, hospitalId: value }))}
              options={[["", "All hospitals"], ...hospitals.map((hospital) => [hospital.id, hospital.name] as [string, string])]}
            />
          ) : null}
          <button type="button" onClick={() => setFilters({ q: "", hospitalId: "", source: "" })} className="h-11 rounded-lg bg-slate-100 px-4 text-sm font-bold text-ink">
            Reset
          </button>
        </div>
      </section>

      {error ? <p className="rounded-lg bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</p> : null}

      <section className="overflow-x-auto rounded-lg bg-white shadow-soft">
        <table className="w-full min-w-[980px] border-collapse text-left text-sm">
          <thead className="bg-slate-50 text-xs font-bold uppercase text-slate-500">
            <tr>
              <th className="px-4 py-4">Sentence</th>
              <th className="px-4 py-4">Context</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={2} className="px-5 py-6 font-semibold text-slate-500">Loading...</td>
              </tr>
            ) : filteredSamples.length === 0 ? (
              <tr>
                <td colSpan={2} className="px-5 py-6 font-semibold text-slate-500">No samples.</td>
              </tr>
            ) : (
              filteredSamples.map((item) => (
                <tr key={item.id} className="border-t border-line align-top">
                  <td className="w-[560px] px-4 py-4">
                    <div className="grid gap-3">
                      <div>
                        <p className="text-[11px] font-bold uppercase text-slate-400">Source</p>
                        <p className="mt-1 whitespace-pre-wrap rounded-lg bg-slate-50 px-3 py-2 text-sm font-semibold leading-6 text-ink">{item.sourceText}</p>
                      </div>
                      <div>
                        <p className="text-[11px] font-bold uppercase text-slate-400">Translation</p>
                        <p className="mt-1 whitespace-pre-wrap rounded-lg bg-blue-50 px-3 py-2 text-sm font-semibold leading-6 text-ink">{item.translatedText}</p>
                      </div>
                    </div>
                  </td>
                  <td className="w-[360px] px-4 py-4">
                    <div className="grid gap-2 text-sm font-semibold text-slate-600">
                      <p><span className="font-bold text-ink">Hospital:</span> {item.hospital?.name ?? item.hospitalId}</p>
                      <p><span className="font-bold text-ink">Staff:</span> {item.staff ? `${item.staff.name} (${item.staff.email})` : "-"}</p>
                      <p><span className="font-bold text-ink">Source:</span> {sourceLabels[item.source] ?? item.source}</p>
                      <p><span className="font-bold text-ink">Direction:</span> {item.direction}</p>
                      <p><span className="font-bold text-ink">Language:</span> {item.sourceLanguage} {"->"} {item.targetLanguage}</p>
                      <p><span className="font-bold text-ink">Model:</span> {item.model ?? "-"}</p>
                      <p><span className="font-bold text-ink">Created:</span> {new Intl.DateTimeFormat(undefined, { dateStyle: "short", timeStyle: "short" }).format(new Date(item.createdAt))}</p>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function SummaryStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-white p-4 shadow-soft">
      <p className="text-xs font-bold uppercase text-slate-400">{label}</p>
      <p className="mt-1 text-2xl font-bold text-ink">{value}</p>
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
