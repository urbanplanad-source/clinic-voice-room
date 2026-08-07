"use client";

import { AlertTriangle, QrCode } from "lucide-react";
import { useEffect, useState } from "react";
import { patientLanguages, type PatientLanguage } from "@/lib/languages";
import { patientUnavailableCopy } from "./PatientJoin";

function browserLanguage(): PatientLanguage {
  if (typeof navigator === "undefined") return "en";
  const value = navigator.language.toLowerCase();
  if (value.startsWith("zh-hk") || value.startsWith("yue")) return "yue";
  if (value.startsWith("zh-tw")) return "zh_tw";
  const base = value.split("-")[0];
  return patientLanguages.includes(base as PatientLanguage) ? base as PatientLanguage : "en";
}

export function PatientRoomUnavailable({ language }: { language?: PatientLanguage }) {
  const [resolvedLanguage, setResolvedLanguage] = useState<PatientLanguage>(language ?? "en");
  useEffect(() => { if (!language) setResolvedLanguage(browserLanguage()); }, [language]);
  const copy = patientUnavailableCopy[resolvedLanguage];
  return <section className="rounded-lg border border-rose-200 bg-white p-6 shadow-soft" role="alert"><span className="grid h-12 w-12 place-items-center rounded-lg bg-rose-50 text-coral-text"><AlertTriangle size={25} aria-hidden="true" /></span><h1 className="mt-4 text-2xl font-bold leading-tight text-ink">{copy.title}</h1><p className="mt-3 text-base font-semibold leading-7 text-slate-700">{copy.body}</p><div className="mt-5 flex items-start gap-3 rounded-lg bg-blue-50 px-4 py-4 text-trust-text"><QrCode size={22} className="mt-0.5 shrink-0" aria-hidden="true" /><p className="font-bold leading-6">{copy.recovery}</p></div></section>;
}
