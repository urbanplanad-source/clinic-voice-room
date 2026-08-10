export function AdminLoadingSkeleton({ rows = 4, label = "데이터를 불러오는 중입니다" }: { rows?: number; label?: string }) {
  return (
    <div className="space-y-3 p-4" role="status" aria-live="polite" aria-busy="true">
      <span className="sr-only">{label}</span>
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="rounded-lg border border-line bg-white p-3">
          <div className="h-4 w-2/5 animate-pulse rounded bg-slate-200 motion-reduce:animate-none" />
          <div className="mt-3 h-3 w-full animate-pulse rounded bg-slate-100 motion-reduce:animate-none" />
          <div className="mt-2 h-3 w-3/4 animate-pulse rounded bg-slate-100 motion-reduce:animate-none" />
        </div>
      ))}
    </div>
  );
}