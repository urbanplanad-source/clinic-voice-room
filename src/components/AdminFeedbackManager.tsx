"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AdminLoadingSkeleton } from "@/components/AdminLoadingSkeleton";
import { BookOpen, Loader2, RefreshCw, Save, Search } from "lucide-react";

type FeedbackStatus = "new" | "reviewed" | "fixed" | "dismissed";

type HospitalOption = {
  id: string;
  name: string;
  slug: string;
};

type TranslationFeedback = {
  id: string;
  hospitalId: string;
  hospital?: { id: string; name: string; slug: string } | null;
  roomId: string | null;
  messageId: string | null;
  sourceText: string;
  translatedText: string;
  sourceLanguage: string;
  targetLanguage: string;
  reporterRole: string;
  reason: string | null;
  status: FeedbackStatus;
  createdAt: string;
  reviewedAt: string | null;
};

const statuses = ["new", "reviewed", "fixed", "dismissed"] as const;

const statusLabels: Record<FeedbackStatus, string> = {
  new: "New",
  reviewed: "Reviewed",
  fixed: "Fixed",
  dismissed: "Dismissed"
};

const reasonLabels: Record<string, string> = {
  mistranslation: "Mistranslation",
  wrong_term: "Wrong term",
  awkward: "Awkward",
  other: "Other"
};

export function AdminFeedbackManager() {
  const [feedback, setFeedback] = useState<TranslationFeedback[]>([]);
  const [hospitals, setHospitals] = useState<HospitalOption[]>([]);
  const [filters, setFilters] = useState({ q: "", status: "", hospitalId: "" });
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    if (filters.status) params.set("status", filters.status);
    if (filters.hospitalId) params.set("hospitalId", filters.hospitalId);
    return params.toString();
  }, [filters.hospitalId, filters.status]);

  const filteredFeedback = useMemo(() => {
    const q = filters.q.trim().toLowerCase();
    if (!q) return feedback;
    return feedback.filter((item) => {
      const haystack = [
        item.hospital?.name ?? "",
        item.sourceText,
        item.translatedText,
        item.reason ? reasonLabels[item.reason] ?? item.reason : "",
        item.sourceLanguage,
        item.targetLanguage,
        item.reporterRole
      ].join(" ").toLowerCase();
      return haystack.includes(q);
    });
  }, [feedback, filters.q]);

  async function loadFeedback() {
    setLoading(true);
    setError("");
    const response = await fetch(`/api/admin/feedback${queryString ? `?${queryString}` : ""}`, { cache: "no-store" });
    setLoading(false);
    if (!response.ok) {
      setError("Feedback could not be loaded.");
      return;
    }

    const data = await response.json();
    setFeedback((data.feedback ?? []) as TranslationFeedback[]);
    setHospitals((data.hospitals ?? []) as HospitalOption[]);
  }

  useEffect(() => {
    void loadFeedback();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryString]);

  async function updateStatus(item: TranslationFeedback, status: FeedbackStatus) {
    setBusyId(item.id);
    setError("");
    setNotice("");
    const response = await fetch("/api/admin/feedback", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: item.id, status })
    });
    setBusyId("");

    if (!response.ok) {
      const data = await response.json().catch(() => null);
      setError(data?.error ?? "Feedback status could not be saved.");
      return;
    }

    setNotice("Feedback status saved.");
    await loadFeedback();
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-bold text-trust-text">Translation Feedback</p>
          <h1 className="mt-1 text-[30px] font-bold leading-tight text-ink">Reported Sentences</h1>
        </div>
        <button type="button" onClick={() => void loadFeedback()} className="inline-flex h-11 items-center gap-2 rounded-lg bg-white px-4 text-sm font-bold text-ink shadow-sm">
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
          <Select
            value={filters.status}
            onChange={(value) => setFilters((current) => ({ ...current, status: value }))}
            options={[["", "All statuses"], ...statuses.map((status) => [status, statusLabels[status]] as [string, string])]}
          />
          {hospitals.length ? (
            <Select
              value={filters.hospitalId}
              onChange={(value) => setFilters((current) => ({ ...current, hospitalId: value }))}
              options={[["", "All hospitals"], ...hospitals.map((hospital) => [hospital.id, hospital.name] as [string, string])]}
            />
          ) : null}
          <button type="button" onClick={() => setFilters({ q: "", status: "", hospitalId: "" })} className="h-11 rounded-lg bg-slate-100 px-4 text-sm font-bold text-ink">
            Reset
          </button>
        </div>
      </section>

      <p className="rounded-lg bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">
        Do not submit or preserve sentences containing patient names, phone numbers, IDs, or other personal information.
      </p>
      {error ? <p className="rounded-lg bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</p> : null}
      {notice ? <p className="rounded-lg bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">{notice}</p> : null}

      <section className="overflow-x-auto rounded-lg bg-white shadow-soft">
        <table className="w-full min-w-[1280px] border-collapse text-left text-sm">
          <thead className="bg-slate-50 text-xs font-bold uppercase text-slate-500">
            <tr>
              <th className="px-4 py-4">Sentence</th>
              <th className="px-4 py-4">Context</th>
              <th className="px-4 py-4">Status</th>
              <th className="px-4 py-4">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={4} className="p-0"><AdminLoadingSkeleton rows={3} /></td>
              </tr>
            ) : filteredFeedback.length === 0 ? (
              <tr>
                <td colSpan={4} className="p-0"><AdminLoadingSkeleton rows={3} /></td>
              </tr>
            ) : (
              filteredFeedback.map((item) => (
                <tr key={item.id} className="border-t border-line align-top">
                  <td className="w-[520px] px-4 py-4">
                    <div className="grid gap-3">
                      <div>
                        <p className="text-xs font-bold uppercase text-muted">Source</p>
                        <p className="mt-1 whitespace-pre-wrap rounded-lg bg-slate-50 px-3 py-2 text-sm font-semibold leading-6 text-ink">{item.sourceText}</p>
                      </div>
                      <div>
                        <p className="text-xs font-bold uppercase text-muted">Translation</p>
                        <p className="mt-1 whitespace-pre-wrap rounded-lg bg-blue-50 px-3 py-2 text-sm font-semibold leading-6 text-ink">{item.translatedText}</p>
                      </div>
                    </div>
                  </td>
                  <td className="w-[300px] px-4 py-4">
                    <div className="grid gap-2 text-sm font-semibold text-slate-600">
                      <p><span className="font-bold text-ink">Hospital:</span> {item.hospital?.name ?? item.hospitalId}</p>
                      <p><span className="font-bold text-ink">Language:</span> {item.sourceLanguage} {"->"} {item.targetLanguage}</p>
                      <p><span className="font-bold text-ink">Reporter:</span> {item.reporterRole}</p>
                      <p><span className="font-bold text-ink">Reason:</span> {item.reason ? reasonLabels[item.reason] ?? item.reason : "-"}</p>
                      <p><span className="font-bold text-ink">Created:</span> {new Intl.DateTimeFormat(undefined, { dateStyle: "short", timeStyle: "short" }).format(new Date(item.createdAt))}</p>
                    </div>
                  </td>
                  <td className="w-[180px] px-4 py-4">
                    <Select
                      value={item.status}
                      onChange={(value) => void updateStatus(item, value as FeedbackStatus)}
                      options={statuses.map((status) => [status, statusLabels[status]] as [string, string])}
                    />
                  </td>
                  <td className="w-[220px] px-4 py-4">
                    <div className="grid gap-2">
                      <Link href={`/admin/glossary?feedbackId=${encodeURIComponent(item.id)}`} className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-trust px-3 text-sm font-bold text-white">
                        <BookOpen size={16} />
                        Make glossary
                      </Link>
                      <button
                        type="button"
                        onClick={() => void updateStatus(item, item.status === "fixed" ? "reviewed" : "fixed")}
                        disabled={busyId === item.id}
                        className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-slate-100 px-3 text-sm font-bold text-ink disabled:opacity-50"
                      >
                        {busyId === item.id ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                        {item.status === "fixed" ? "Mark reviewed" : "Mark fixed"}
                      </button>
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

function Select({ value, onChange, options }: { value: string; onChange: (value: string) => void; options: Array<[string, string]> }) {
  return (
    <select className="h-11 w-full rounded-lg border border-line bg-slate-50 px-3 text-sm font-semibold outline-none focus:border-trust focus:bg-white" value={value} onChange={(event) => onChange(event.target.value)}>
      {options.map(([optionValue, label]) => (
        <option key={optionValue} value={optionValue}>
          {label}
        </option>
      ))}
    </select>
  );
}
