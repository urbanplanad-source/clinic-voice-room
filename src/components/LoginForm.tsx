"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const savedEmail = window.localStorage.getItem("cvr_login_email");
    if (savedEmail) {
      setEmail(savedEmail);
    }
  }, []);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, remember })
    });
    setLoading(false);

    if (!response.ok) {
      setError("로그인 정보를 확인해주세요.");
      return;
    }

    if (remember) {
      window.localStorage.setItem("cvr_login_email", email.trim().toLowerCase());
    } else {
      window.localStorage.removeItem("cvr_login_email");
    }

    router.replace("/staff");
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="space-y-7 rounded-lg bg-white p-6 shadow-soft sm:p-7">
      <div className="space-y-2">
        <p className="text-sm font-bold text-trust">Clinic Voice Room</p>
        <h1 className="text-[28px] font-bold leading-tight text-ink">병원 통역실 로그인</h1>
      </div>

      <div className="space-y-4">
        <label className="block">
          <span className="text-sm font-semibold text-slate-600">이메일</span>
          <input
            className="mt-2 h-14 w-full rounded-lg border border-line bg-slate-50 px-4 text-base outline-none transition focus:border-trust focus:bg-white"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            type="email"
            autoComplete="email"
            placeholder="staff@bellemon.kr"
            required
          />
        </label>
        <label className="block">
          <span className="text-sm font-semibold text-slate-600">비밀번호</span>
          <input
            className="mt-2 h-14 w-full rounded-lg border border-line bg-slate-50 px-4 text-base outline-none transition focus:border-trust focus:bg-white"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            type="password"
            autoComplete="current-password"
            placeholder="발급받은 비밀번호"
            required
          />
        </label>
      </div>

      <label className="flex items-start gap-3 rounded-lg bg-slate-50 px-4 py-3">
        <input
          className="mt-1 h-4 w-4"
          type="checkbox"
          checked={remember}
          onChange={(event) => setRemember(event.target.checked)}
        />
        <span>
          <span className="block text-sm font-bold text-ink">이 기기에서 로그인 유지</span>
          <span className="mt-1 block text-xs font-semibold leading-5 text-slate-500">다음부터는 로그인 화면 없이 바로 직원 화면으로 이동합니다.</span>
        </span>
      </label>

      {error ? <p className="rounded-lg bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</p> : null}

      <button
        className="flex h-14 w-full items-center justify-center gap-2 rounded-lg bg-trust px-4 font-bold text-white transition hover:bg-blue-600 disabled:opacity-50"
        disabled={loading}
      >
        {loading ? "로그인 중" : "로그인"}
        <ArrowRight size={18} />
      </button>
    </form>
  );
}
