"use client";

import Link from "next/link";
import { BookOpenText, ClipboardCheck, Database } from "lucide-react";

type QualityWorkspacePage = "samples" | "glossary" | "datasets";

export function AdminQualityWorkspaceNav({ active, queueCount }: { active: QualityWorkspacePage; queueCount?: number }) {
  const items = [
    { key: "samples" as const, href: "/admin/samples", label: "검수 대기함", icon: ClipboardCheck },
    { key: "glossary" as const, href: "/admin/glossary", label: "품질 자산", icon: BookOpenText },
    { key: "datasets" as const, href: "/admin/datasets", label: "데이터셋 검수", icon: Database }
  ];

  return (
    <nav aria-label="번역 품질 관리" className="flex min-h-12 items-end gap-1 overflow-x-auto border-b border-line">
      {items.map((item) => {
        const Icon = item.icon;
        const selected = active === item.key;
        return (
          <Link
            key={item.key}
            href={item.href}
            aria-current={selected ? "page" : undefined}
            className={`inline-flex min-h-12 shrink-0 items-center gap-2 border-b-2 px-4 text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-trust focus-visible:ring-offset-2 ${selected ? "border-trust text-trust" : "border-transparent text-slate-500 hover:text-ink"}`}
          >
            <Icon size={18} aria-hidden="true" />
            {item.label}
            {item.key === "samples" && typeof queueCount === "number" ? (
              <span className={`rounded-full px-2 py-0.5 text-xs ${selected ? "bg-blue-50 text-trust" : "bg-slate-100 text-slate-600"}`}>{queueCount}</span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
