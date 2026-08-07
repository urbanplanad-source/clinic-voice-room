"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

export function BackButton({ href = "/staff", label = "뒤로가기" }: { href?: string; label?: string }) {
  const router = useRouter();

  function goBack() {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
      return;
    }
    router.push(href);
  }

  return (
    <button
      type="button"
      onClick={goBack}
      className="mb-4 inline-flex h-11 items-center gap-2 rounded-lg bg-white px-4 text-sm font-bold text-ink shadow-sm transition hover:bg-slate-50"
    >
      <ArrowLeft size={18} className="text-trust-text" />
      {label}
    </button>
  );
}
