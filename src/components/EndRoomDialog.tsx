"use client";

import { AlertTriangle, Loader2, PhoneOff, RotateCcw } from "lucide-react";

export function EndRoomDialog({ open, ending, error, onCancel, onConfirm, onRetry }: { open: boolean; ending: boolean; error?: string; onCancel: () => void; onConfirm: () => void; onRetry: () => void }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/45 p-4 sm:items-center" role="presentation">
      <section className="w-full max-w-md rounded-lg bg-white p-5 shadow-soft" role="alertdialog" aria-modal="true" aria-labelledby="end-room-title" aria-describedby="end-room-description">
        <div className="flex items-start gap-3"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-md bg-rose-50 text-coral-text"><AlertTriangle size={23} aria-hidden="true" /></span><div><h2 id="end-room-title" className="text-xl font-bold text-ink">통역방을 종료할까요?</h2><p id="end-room-description" className="mt-2 text-sm font-semibold leading-6 text-slate-600">통역방을 종료하면 환자는 다시 입장할 수 없습니다.</p></div></div>
        {error ? <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3" role="alert"><p className="text-sm font-bold leading-6 text-coral-text">{error}</p><button type="button" onClick={onRetry} disabled={ending} className="mt-2 inline-flex min-h-11 items-center gap-2 rounded-md bg-white px-4 text-sm font-bold text-coral-text shadow-sm disabled:opacity-60"><RotateCcw size={17} aria-hidden="true" />상태 다시 확인</button></div> : null}
        <div className="mt-5 grid gap-2 sm:grid-cols-2"><button type="button" autoFocus onClick={onCancel} disabled={ending} className="min-h-12 rounded-md border border-slate-300 bg-white px-4 font-bold text-ink disabled:opacity-60">취소하고 계속 사용</button><button type="button" onClick={onConfirm} disabled={ending} className="flex min-h-12 items-center justify-center gap-2 rounded-md bg-coral-text px-4 font-bold text-white disabled:opacity-60">{ending ? <Loader2 size={18} className="animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <PhoneOff size={18} aria-hidden="true" />}{ending ? "종료 확인 중" : "통역방 종료"}</button></div>
      </section>
    </div>
  );
}
