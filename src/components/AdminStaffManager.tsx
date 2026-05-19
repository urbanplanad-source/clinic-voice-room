"use client";

import { useEffect, useState } from "react";
import { ArrowRight, Copy, Loader2, Save, UserPlus } from "lucide-react";

type StaffUser = {
  id: string;
  name: string;
  email: string;
  role: "staff" | "hospital_admin" | "internal_admin";
  isActive: boolean;
  lastLoginAt?: string | null;
  hospital: { name: string; slug: string };
};

type FormState = {
  hospitalName: string;
  hospitalSlug: string;
  name: string;
  email: string;
  password: string;
  role: "staff" | "hospital_admin";
};

const initialForm: FormState = {
  hospitalName: "벨르몬성형외과",
  hospitalSlug: "bellemon",
  name: "",
  email: "",
  password: "",
  role: "staff"
};

export function AdminStaffManager() {
  const [form, setForm] = useState<FormState>(initialForm);
  const [staffUsers, setStaffUsers] = useState<StaffUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [createdPassword, setCreatedPassword] = useState("");
  const [createdEmail, setCreatedEmail] = useState("");

  async function loadStaff() {
    setLoading(true);
    const response = await fetch("/api/admin/staff", { cache: "no-store" });
    setLoading(false);
    if (!response.ok) {
      setError("직원 계정 목록을 불러오지 못했습니다.");
      return;
    }
    const data = await response.json();
    setStaffUsers(data.staffUsers ?? []);
  }

  useEffect(() => {
    void loadStaff();
  }, []);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function saveStaff(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setCreatedPassword("");
    setCreatedEmail("");

    const response = await fetch("/api/admin/staff", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form)
    });
    const data = await response.json().catch(() => ({}));
    setSaving(false);

    if (!response.ok) {
      setError("계정을 저장하지 못했습니다. 이메일 형식과 비밀번호 길이를 확인해주세요.");
      return;
    }

    setCreatedPassword(data.temporaryPassword ?? "");
    setCreatedEmail(form.email);
    setForm((current) => ({ ...current, name: "", email: "", password: "" }));
    await loadStaff();
  }

  async function copyCredentials() {
    if (!createdPassword) return;
    await navigator.clipboard.writeText(`Email: ${createdEmail}\nPassword: ${createdPassword}`);
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-bold text-trust">Internal Admin</p>
          <h1 className="mt-1 text-[30px] font-bold leading-tight text-ink">직원 계정 관리</h1>
        </div>
        <a
          href="/admin/usage"
          className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-white px-4 text-sm font-bold text-ink shadow-sm transition hover:bg-slate-50"
        >
          사용량 보기
          <ArrowRight size={17} />
        </a>
      </header>

      <form onSubmit={saveStaff} className="rounded-lg bg-white p-5 shadow-soft sm:p-6">
        <div className="flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-lg bg-blue-50 text-trust">
            <UserPlus size={22} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-ink">병원 직원 로그인 생성</h2>
            <p className="mt-1 text-sm font-semibold text-slate-500">비밀번호를 비워두면 임시 비밀번호가 자동 생성됩니다.</p>
          </div>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <Field label="병원명" value={form.hospitalName} onChange={(value) => update("hospitalName", value)} required />
          <Field
            label="병원 코드"
            value={form.hospitalSlug}
            onChange={(value) => update("hospitalSlug", value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
            required
          />
          <Field label="직원 이름" value={form.name} onChange={(value) => update("name", value)} required />
          <Field label="로그인 이메일" value={form.email} onChange={(value) => update("email", value)} type="email" required />
          <Field
            label="임시 비밀번호"
            value={form.password}
            onChange={(value) => update("password", value)}
            type="text"
            placeholder="비워두면 자동 생성"
          />
          <label className="block">
            <span className="text-sm font-semibold text-slate-600">권한</span>
            <select
              className="mt-2 h-12 w-full rounded-lg border border-line bg-slate-50 px-3 text-base font-semibold outline-none transition focus:border-trust focus:bg-white"
              value={form.role}
              onChange={(event) => update("role", event.target.value as FormState["role"])}
            >
              <option value="staff">일반 직원</option>
              <option value="hospital_admin">병원 관리자</option>
            </select>
          </label>
        </div>

        {error ? <p className="mt-4 rounded-lg bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</p> : null}
        {createdPassword ? (
          <div className="mt-4 rounded-lg bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <span>
              {createdEmail} 임시 비밀번호: {createdPassword}
            </span>
              <button type="button" onClick={copyCredentials} className="inline-flex items-center gap-2 font-bold text-emerald-900">
                <Copy size={16} />
                복사
              </button>
            </div>
          </div>
        ) : null}

        <button
          className="mt-5 inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-trust px-4 font-bold text-white transition hover:bg-blue-600 disabled:opacity-50 sm:w-auto"
          disabled={saving}
        >
          {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
          저장
        </button>
      </form>

      <section className="overflow-x-auto rounded-lg bg-white shadow-soft">
        <table className="w-full min-w-[760px] border-collapse text-left text-sm">
          <thead className="bg-slate-50 text-xs font-bold uppercase text-slate-500">
            <tr>
              <th className="px-5 py-4">Hospital</th>
              <th className="px-5 py-4">Name</th>
              <th className="px-5 py-4">Email</th>
              <th className="px-5 py-4">Role</th>
              <th className="px-5 py-4">Last login</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="px-5 py-6 font-semibold text-slate-500">
                  불러오는 중...
                </td>
              </tr>
            ) : (
              staffUsers.map((staffUser) => (
                <tr key={staffUser.id} className="border-t border-line">
                  <td className="px-5 py-4 font-bold text-ink">{staffUser.hospital.name}</td>
                  <td className="px-5 py-4 font-semibold text-slate-700">{staffUser.name}</td>
                  <td className="px-5 py-4 font-semibold text-slate-600">{staffUser.email}</td>
                  <td className="px-5 py-4 font-semibold text-slate-600">{staffUser.role}</td>
                  <td className="px-5 py-4 font-semibold text-slate-600">
                    {staffUser.lastLoginAt ? new Date(staffUser.lastLoginAt).toLocaleDateString("ko-KR") : "-"}
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

function Field({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  required = false
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="text-sm font-semibold text-slate-600">{label}</span>
      <input
        className="mt-2 h-12 w-full rounded-lg border border-line bg-slate-50 px-3 text-base outline-none transition focus:border-trust focus:bg-white"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        type={type}
        placeholder={placeholder}
        required={required}
      />
    </label>
  );
}
