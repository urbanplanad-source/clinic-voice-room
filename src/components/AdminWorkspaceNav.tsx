import Link from "next/link";
import { BarChart3, BookOpenText, ClipboardCheck, Database, MessageSquareWarning, ShieldAlert, UsersRound } from "lucide-react";

export type AdminWorkspacePage = "samples" | "glossary" | "datasets" | "quick-phrases" | "feedback" | "staff" | "usage";

const items = [
  { key: "samples" as const, href: "/admin/samples", label: "검수 대기함", icon: ClipboardCheck },
  { key: "glossary" as const, href: "/admin/glossary", label: "품질 자산", icon: BookOpenText },
  { key: "datasets" as const, href: "/admin/datasets", label: "데이터셋 검수", icon: Database },
  { key: "quick-phrases" as const, href: "/admin/quick-phrases", label: "비상 문구", icon: ShieldAlert },
  { key: "feedback" as const, href: "/admin/feedback", label: "번역 피드백", icon: MessageSquareWarning },
  { key: "staff" as const, href: "/admin/staff", label: "직원 관리", icon: UsersRound, internalOnly: true },
  { key: "usage" as const, href: "/admin/usage", label: "사용량", icon: BarChart3, internalOnly: true }
];

export function AdminWorkspaceNav({ role, active }: { role: string; active: AdminWorkspacePage }) {
  const visibleItems = items.filter((item) => !item.internalOnly || role === "internal_admin");

  return (
    <nav aria-label="관리자 작업 메뉴" className="mb-6 overflow-x-auto border-b border-line bg-mist pb-px">
      <div className="flex min-w-max items-end gap-1">
        {visibleItems.map((item) => {
          const Icon = item.icon;
          const selected = item.key === active;
          return (
            <Link
              key={item.key}
              href={item.href}
              aria-current={selected ? "page" : undefined}
              className={`inline-flex min-h-12 items-center gap-2 border-b-2 px-3.5 text-sm font-bold transition-colors ${selected ? "border-trust bg-blue-50 text-trust-text" : "border-transparent text-text-secondary hover:border-line-strong hover:bg-white hover:text-ink"}`}
            >
              <Icon size={18} aria-hidden="true" />
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}