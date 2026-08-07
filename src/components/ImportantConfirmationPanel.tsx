"use client";

import { AlertTriangle, CheckCircle2, Loader2, RotateCcw, Volume2 } from "lucide-react";

const categoryDisplay: Record<string, { symbol: string; label: string }> = {
  number: { symbol: "123", label: "Numbers" },
  amount: { symbol: "$", label: "Price" },
  date_time: { symbol: "DATE", label: "Date / time" },
  dose_unit_frequency: { symbol: "cc x", label: "Dose / count" },
  laterality: { symbol: "L / R", label: "Left / right" },
  negation: { symbol: "NO", label: "Do not" }
};

export type ConfirmationActionStatus = "idle" | "submitting" | "confirmed" | "repeat_requested" | "failed";

export function ImportantConfirmationPanel({ title, body, sentence, categories, confirmLabel, repeatLabel, replayLabel, retryLabel, status, error, onConfirm, onRepeat, onReplay, onRetry }: {
  title: string;
  body?: string;
  sentence: string;
  categories: string[];
  confirmLabel: string;
  repeatLabel: string;
  replayLabel: string;
  retryLabel: string;
  status: ConfirmationActionStatus;
  error?: string;
  onConfirm: () => void;
  onRepeat: () => void;
  onReplay: () => void;
  onRetry: () => void;
}) {
  const busy = status === "submitting";
  return (
    <section className="border-b-2 border-amber-300 bg-amber-50 px-3 py-4 md:px-6" aria-labelledby="important-confirmation-title">
      <div role="status" aria-live="assertive" aria-atomic="true">
        <p id="important-confirmation-title" className="flex items-start gap-2 text-base font-bold leading-6 text-amber-950">
          {status === "confirmed" ? <CheckCircle2 size={21} className="mt-0.5 shrink-0 text-emerald-700" aria-hidden="true" /> : <AlertTriangle size={21} className="mt-0.5 shrink-0" aria-hidden="true" />}
          {status === "confirmed" ? confirmLabel : title}
        </p>
        {body ? <p className="mt-1 text-sm font-semibold leading-6 text-amber-900">{body}</p> : null}
      </div>
      <p className="mt-3 whitespace-pre-wrap break-words rounded-lg border border-amber-200 bg-white px-4 py-3 text-base font-bold leading-7 text-ink">{sentence}</p>
      {categories.length ? (
        <div className="mt-3 flex flex-wrap gap-2" aria-label="Important items to check">
          {categories.map((category) => {
            const item = categoryDisplay[category] ?? { symbol: "!", label: category };
            return <span key={category} className="inline-flex min-h-9 items-center gap-2 rounded-md border border-amber-300 bg-white px-3 text-xs font-bold text-amber-950"><span className="font-black text-coral-text" aria-hidden="true">{item.symbol}</span>{item.label}</span>;
          })}
        </div>
      ) : null}
      {status === "failed" ? (
        <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-3" role="alert">
          <p className="text-sm font-bold text-coral-text">{error || "The response could not be saved. Please try again."}</p>
          <button type="button" onClick={onRetry} className="mt-2 inline-flex min-h-11 items-center gap-2 rounded-md bg-white px-4 text-sm font-bold text-coral-text shadow-sm"><RotateCcw size={17} aria-hidden="true" />{retryLabel}</button>
        </div>
      ) : null}
      {status !== "confirmed" ? (
        <div className="mt-4 grid gap-2 sm:grid-cols-3">
          <button type="button" disabled={busy} onClick={onConfirm} className="flex min-h-12 items-center justify-center gap-2 rounded-md bg-emerald-700 px-3 font-bold text-white disabled:opacity-60">{busy ? <Loader2 className="animate-spin motion-reduce:animate-none" size={18} aria-hidden="true" /> : <CheckCircle2 size={18} aria-hidden="true" />}{confirmLabel}</button>
          <button type="button" disabled={busy} onClick={onRepeat} className="min-h-12 rounded-md border-2 border-amber-600 bg-white px-3 font-bold text-amber-950 disabled:opacity-60">{repeatLabel}</button>
          <button type="button" disabled={busy} onClick={onReplay} className="flex min-h-12 items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-3 font-bold text-ink disabled:opacity-60"><Volume2 size={18} aria-hidden="true" />{replayLabel}</button>
        </div>
      ) : null}
    </section>
  );
}
