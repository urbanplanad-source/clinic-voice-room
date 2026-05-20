"use client";

import { useEffect, useState } from "react";
import { ArrowRight, Copy, KeyRound, Loader2, Save, Trash2, UserPlus } from "lucide-react";

type StaffRole = "staff" | "hospital_admin" | "internal_admin";

type StaffUser = {
  id: string;
  name: string;
  email: string;
  role: StaffRole;
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

type EditState = {
  hospitalName: string;
  hospitalSlug: string;
  name: string;
  email: string;
  password: string;
  role: StaffRole;
  isActive: boolean;
};

const initialForm: FormState = {
  hospitalName: "벨르몬성형외과",
  hospitalSlug: "bellemon",
  name: "",
  email: "",
  password: "",
  role: "staff"
};

function editStateFromStaff(staffUser: StaffUser): EditState {
  return {
    hospitalName: staffUser.hospital.name,
    hospitalSlug: staffUser.hospital.slug,
    name: staffUser.name,
    email: staffUser.email,
    password: "",
    role: staffUser.role,
    isActive: staffUser.isActive
  };
}

export function AdminStaffManager() {
  const [form, setForm] = useState<FormState>(initialForm);
  const [staffUsers, setStaffUsers] = useState<StaffUser[]>([]);
  const [edits, setEdits] = useState<Record<string, EditState>>({});
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
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
    const nextStaffUsers = (data.staffUsers ?? []) as StaffUser[];
    setStaffUsers(nextStaffUsers);
    setEdits(Object.fromEntries(nextStaffUsers.map((staffUser) => [staffUser.id, editStateFromStaff(staffUser)])));
  }

  useEffect(() => {
    void loadStaff();
  }, []);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function updateEdit<K extends keyof EditState>(staffUserId: string, key: K, value: EditState[K]) {
    setEdits((current) => ({
      ...current,
      [staffUserId]: {
        ...current[staffUserId],
        [key]: value
      }
    }));
  }

  function resetMessages() {
    setError("");
    setNotice("");
    setCreatedPassword("");
    setCreatedEmail("");
  }

  async function saveStaff(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    resetMessages();

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
    setNotice("직원 계정을 저장했습니다.");
    setForm((current) => ({ ...current, name: "", email: "", password: "" }));
    await loadStaff();
  }

  async function saveEdit(staffUserId: string, generatePassword = false) {
    const edit = edits[staffUserId];
    if (!edit) return;

    setBusyId(staffUserId);
    resetMessages();
    const response = await fetch("/api/admin/staff", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ staffUserId, ...edit, generatePassword })
    });
    const data = await response.json().catch(() => ({}));
    setBusyId(null);

    if (!response.ok) {
      setError(data.error === "Email already exists" ? "이미 사용 중인 이메일입니다." : "계정 정보를 수정하지 못했습니다.");
      return;
    }

    if (data.temporaryPassword) {
      setCreatedEmail(edit.email);
      setCreatedPassword(data.temporaryPassword);
      setNotice("임시 비밀번호로 교체했습니다.");
    } else {
      setNotice("계정 정보를 수정했습니다.");
    }
    await loadStaff();
  }

  async function deleteStaff(staffUser: StaffUser) {
    const confirmed = window.confirm(`${staffUser.name} 계정을 삭제하시겠습니까?\n사용 기록이 있는 계정은 삭제 대신 비활성화됩니다.`);
    if (!confirmed) return;

    setBusyId(staffUser.id);
    resetMessages();
    const response = await fetch("/api/admin/staff", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ staffUserId: staffUser.id })
    });
    const data = await response.json().catch(() => ({}));
    setBusyId(null);

    if (!response.ok) {
      setError(data.error === "Cannot delete the current admin account" ? "현재 로그인한 관리자 계정은 삭제할 수 없습니다." : "계정을 삭제하지 못했습니다.");
      return;
    }

    setNotice(data.deactivated ? "사용 기록이 있어 계정을 비활성화했습니다." : "계정을 삭제했습니다.");
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
          <Field label="임시 비밀번호" value={form.password} onChange={(value) => update("password", value)} placeholder="비워두면 자동 생성" />
          <RoleSelect value={form.role} onChange={(value) => update("role", value as FormState["role"])} includeInternalAdmin={false} />
        </div>

        <button
          className="mt-5 inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-trust px-4 font-bold text-white transition hover:bg-blue-600 disabled:opacity-50 sm:w-auto"
          disabled={saving}
        >
          {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
          저장
        </button>
      </form>

      {error ? <p className="rounded-lg bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</p> : null}
      {notice ? <p className="rounded-lg bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">{notice}</p> : null}
      {createdPassword ? (
        <div className="rounded-lg bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
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

      <section className="overflow-x-auto rounded-lg bg-white shadow-soft">
        <table className="w-full min-w-[1180px] border-collapse text-left text-sm">
          <thead className="bg-slate-50 text-xs font-bold uppercase text-slate-500">
            <tr>
              <th className="px-4 py-4">Hospital</th>
              <th className="px-4 py-4">Name</th>
              <th className="px-4 py-4">Email</th>
              <th className="px-4 py-4">Role</th>
              <th className="px-4 py-4">Status</th>
              <th className="px-4 py-4">New password</th>
              <th className="px-4 py-4">Last login</th>
              <th className="px-4 py-4">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} className="px-5 py-6 font-semibold text-slate-500">
                  불러오는 중...
                </td>
              </tr>
            ) : (
              staffUsers.map((staffUser) => {
                const edit = edits[staffUser.id] ?? editStateFromStaff(staffUser);
                const disabled = busyId === staffUser.id;
                return (
                  <tr key={staffUser.id} className="border-t border-line align-top">
                    <td className="px-4 py-4">
                      <div className="grid gap-2">
                        <InlineInput value={edit.hospitalName} onChange={(value) => updateEdit(staffUser.id, "hospitalName", value)} disabled={disabled} />
                        <InlineInput
                          value={edit.hospitalSlug}
                          onChange={(value) => updateEdit(staffUser.id, "hospitalSlug", value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                          disabled={disabled}
                        />
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <InlineInput value={edit.name} onChange={(value) => updateEdit(staffUser.id, "name", value)} disabled={disabled} />
                    </td>
                    <td className="px-4 py-4">
                      <InlineInput value={edit.email} onChange={(value) => updateEdit(staffUser.id, "email", value)} disabled={disabled} type="email" />
                    </td>
                    <td className="px-4 py-4">
                      <RoleSelect value={edit.role} onChange={(value) => updateEdit(staffUser.id, "role", value)} includeInternalAdmin disabled={disabled} compact />
                    </td>
                    <td className="px-4 py-4">
                      <label className="flex h-10 items-center gap-2 rounded-lg border border-line bg-slate-50 px-3 font-semibold text-slate-700">
                        <input
                          type="checkbox"
                          checked={edit.isActive}
                          onChange={(event) => updateEdit(staffUser.id, "isActive", event.target.checked)}
                          disabled={disabled}
                        />
                        활성
                      </label>
                    </td>
                    <td className="px-4 py-4">
                      <InlineInput
                        value={edit.password}
                        onChange={(value) => updateEdit(staffUser.id, "password", value)}
                        disabled={disabled}
                        placeholder="비워두면 유지"
                      />
                    </td>
                    <td className="px-4 py-4 font-semibold text-slate-600">
                      {staffUser.lastLoginAt ? new Date(staffUser.lastLoginAt).toLocaleDateString("ko-KR") : "-"}
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => saveEdit(staffUser.id)}
                          disabled={disabled}
                          className="inline-flex h-10 items-center gap-2 rounded-lg bg-trust px-3 font-bold text-white transition hover:bg-blue-600 disabled:opacity-50"
                        >
                          {disabled ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                          저장
                        </button>
                        <button
                          type="button"
                          onClick={() => saveEdit(staffUser.id, true)}
                          disabled={disabled}
                          className="inline-flex h-10 items-center gap-2 rounded-lg bg-slate-100 px-3 font-bold text-ink transition hover:bg-slate-200 disabled:opacity-50"
                        >
                          <KeyRound size={16} />
                          자동 비번
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteStaff(staffUser)}
                          disabled={disabled}
                          className="inline-flex h-10 items-center gap-2 rounded-lg bg-rose-50 px-3 font-bold text-rose-700 transition hover:bg-rose-100 disabled:opacity-50"
                        >
                          <Trash2 size={16} />
                          삭제
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function RoleSelect({
  value,
  onChange,
  includeInternalAdmin,
  disabled = false,
  compact = false
}: {
  value: StaffRole;
  onChange: (value: StaffRole) => void;
  includeInternalAdmin: boolean;
  disabled?: boolean;
  compact?: boolean;
}) {
  return (
    <label className="block">
      {!compact ? <span className="text-sm font-semibold text-slate-600">권한</span> : null}
      <select
        className={`${compact ? "h-10" : "mt-2 h-12"} w-full rounded-lg border border-line bg-slate-50 px-3 text-sm font-semibold outline-none transition focus:border-trust focus:bg-white disabled:opacity-60`}
        value={value}
        onChange={(event) => onChange(event.target.value as StaffRole)}
        disabled={disabled}
      >
        <option value="staff">일반 직원</option>
        <option value="hospital_admin">병원 관리자</option>
        {includeInternalAdmin ? <option value="internal_admin">Internal Admin</option> : null}
      </select>
    </label>
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

function InlineInput({
  value,
  onChange,
  type = "text",
  placeholder,
  disabled = false
}: {
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
  disabled?: boolean;
}) {
  return (
    <input
      className="h-10 w-full min-w-[130px] rounded-lg border border-line bg-slate-50 px-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-trust focus:bg-white disabled:opacity-60"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      type={type}
      placeholder={placeholder}
      disabled={disabled}
    />
  );
}
