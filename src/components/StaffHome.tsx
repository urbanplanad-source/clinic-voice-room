"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, BarChart3, Languages, LogOut, Mic, Stethoscope } from "lucide-react";
import { languageLabels, patientLanguages, type PatientLanguage } from "@/lib/languages";

export function StaffHome({
  staff
}: {
  staff: { name: string; hospital: { name: string; planType: string }; role: string };
}) {
  const router = useRouter();
  const [patientLanguage, setPatientLanguage] = useState<PatientLanguage>("zh");
  const [loading, setLoading] = useState(false);

  async function createRoom(mode: "consultation" | "procedure") {
    setLoading(true);
    const response = await fetch("/api/rooms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ patientLanguage })
    });
    setLoading(false);
    if (!response.ok) return;
    const data = await response.json();
    router.push(`/staff/rooms/${data.room.id}?mode=${mode}`);
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  return (
    <div className="space-y-5">
      <header className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-trust">{staff.hospital.name}</p>
          <h1 className="mt-1 text-[30px] font-bold leading-tight text-ink">{staff.name}님</h1>
        </div>
        <button
          onClick={logout}
          className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-white text-slate-500 shadow-sm transition hover:text-ink"
          aria-label="로그아웃"
          title="로그아웃"
        >
          <LogOut size={20} />
        </button>
      </header>

      <section className="rounded-lg bg-white p-5 shadow-soft sm:p-6">
        <div className="flex items-start gap-4">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-lg bg-blue-50 text-trust">
            <Mic size={24} />
          </div>
          <div>
            <h2 className="text-[22px] font-bold leading-tight">음성 통역 시작</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">환자 언어를 선택하고 상담 또는 시술 통역방을 만드세요.</p>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-3" role="radiogroup" aria-label="환자 언어">
          {patientLanguages.map((language) => {
            const active = language === patientLanguage;
            return (
              <button
                key={language}
                type="button"
                onClick={() => setPatientLanguage(language)}
                className={`min-h-[86px] rounded-lg border px-2 py-4 text-center transition ${
                  active ? "border-trust bg-blue-50 text-trust" : "border-line bg-white text-slate-600 hover:bg-slate-50"
                }`}
                aria-pressed={active}
              >
                <span className="block text-base font-bold leading-6">{languageLabels[language].native}</span>
                <span className="mt-1 block text-xs font-semibold">{languageLabels[language].ko}</span>
              </button>
            );
          })}
        </div>

        <div className="mt-6 grid gap-2 sm:grid-cols-2">
          <button
            onClick={() => createRoom("consultation")}
            disabled={loading}
            className="flex h-14 w-full items-center justify-center gap-2 rounded-lg bg-trust px-4 font-bold text-white transition hover:bg-blue-600 disabled:opacity-50"
          >
            <Languages size={20} />
            {loading ? "방 생성 중" : "상담 통역방"}
          </button>
          <button
            onClick={() => createRoom("procedure")}
            disabled={loading}
            className="flex h-14 w-full items-center justify-center gap-2 rounded-lg bg-ink px-4 font-bold text-white transition hover:bg-slate-700 disabled:opacity-50"
          >
            <Stethoscope size={20} />
            {loading ? "방 생성 중" : "시술 통역방"}
          </button>
        </div>
      </section>

      {staff.role === "internal_admin" ? (
        <button
          onClick={() => router.push("/admin/usage")}
          className="flex w-full items-center justify-between rounded-lg bg-white px-5 py-4 font-bold text-ink shadow-sm transition hover:bg-slate-50"
        >
          <span className="inline-flex items-center gap-2">
            <BarChart3 size={19} className="text-trust" />
            관리자 사용량 보기
          </span>
          <ArrowRight size={18} className="text-slate-400" />
        </button>
      ) : null}
    </div>
  );
}
