"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { BookOpenCheck, FileText, Languages, LogOut, MessageSquareWarning, Stethoscope, UsersRound } from "lucide-react";

const adminLinks = [
  { href: "/admin/glossary", label: "용어집", icon: Languages },
  { href: "/admin/quick-phrases", label: "검증 문구", icon: BookOpenCheck },
  { href: "/admin/feedback", label: "번역 피드백", icon: MessageSquareWarning },
  { href: "/admin/samples", label: "번역 샘플", icon: FileText }
];

export function StaffHome({ staff }: { staff: { name: string; hospital: { name: string; planType: string }; role: string } }) {
  const router = useRouter();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  return (
    <div className="flex min-h-[calc(100dvh-96px)] flex-col space-y-5 md:space-y-6">
      <header className="rounded-lg bg-ink p-5 text-white shadow-soft md:p-7">
        <p className="break-words text-sm font-bold text-blue-200">{staff.hospital.name}</p>
        <h1 className="mt-1 text-[30px] font-bold leading-tight md:text-[36px]">텍스트 번역</h1>
        <p className="mt-2 text-sm font-semibold leading-6 text-slate-300 md:text-base">상담 문장을 입력해 환자 언어로 바로 번역합니다.</p>
      </header>

      <Link href="/staff/text-translate" className="flex min-h-[280px] flex-1 flex-col justify-between gap-8 rounded-lg bg-white p-7 text-left shadow-soft transition hover:bg-emerald-50 focus-visible:ring-2 focus-visible:ring-trust-text md:min-h-[380px] md:p-10">
        <span className="grid h-20 w-20 shrink-0 place-items-center rounded-lg bg-emerald-50 text-mint-text md:h-24 md:w-24"><FileText size={40} aria-hidden="true" /></span>
        <span className="min-w-0"><span className="block break-words text-[34px] font-bold leading-tight text-ink md:text-[46px]">텍스트 번역하기</span><span className="mt-3 block text-lg font-semibold leading-8 text-slate-600 md:text-xl">상담 문장 바로 번역</span></span>
      </Link>

      {staff.role !== "staff" ? (
        <section className="rounded-lg border border-line bg-white p-4 shadow-soft" aria-labelledby="admin-tools-title">
          <div className="mb-3 flex items-center gap-2"><Stethoscope size={19} className="text-trust-text" aria-hidden="true" /><h2 id="admin-tools-title" className="text-base font-bold text-ink">관리자 품질 도구</h2></div>
          <div className="grid gap-2 sm:grid-cols-2">
            {adminLinks.map(({ href, label, icon: Icon }) => <Link key={href} href={href} className="flex min-h-12 items-center justify-center gap-2 rounded-lg bg-slate-50 px-3 text-sm font-bold text-ink transition hover:bg-blue-50"><Icon size={18} aria-hidden="true" />{label}</Link>)}
            {staff.role === "internal_admin" ? <><Link href="/admin/staff" className="flex min-h-12 items-center justify-center gap-2 rounded-lg bg-slate-50 px-3 text-sm font-bold text-ink transition hover:bg-blue-50"><UsersRound size={18} aria-hidden="true" />직원 관리</Link><Link href="/admin/usage" className="flex min-h-12 items-center justify-center gap-2 rounded-lg bg-slate-50 px-3 text-sm font-bold text-ink transition hover:bg-blue-50"><Languages size={18} aria-hidden="true" />사용량</Link></> : null}
          </div>
        </section>
      ) : null}

      <div className="mt-auto pt-4"><button type="button" onClick={logout} className="flex min-h-14 w-full items-center justify-center gap-2 rounded-lg bg-rose-50 px-5 text-base font-bold text-coral-text shadow-sm transition hover:bg-rose-100" aria-label="로그아웃"><LogOut size={22} aria-hidden="true" />로그아웃</button></div>
    </div>
  );
}
