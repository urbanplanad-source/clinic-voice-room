"use client";

import { AlertTriangle, QrCode } from "lucide-react";
import { useEffect, useState } from "react";
import { patientLanguages, patientLanguageTags, type PatientLanguage } from "@/lib/languages";
import { PatientTextSizeControl, patientTextSizeClassName, usePatientTextSize } from "./PatientTextSizeControl";
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
  const [patientTextSize, setPatientTextSize] = usePatientTextSize();
  useEffect(() => { if (!language) setResolvedLanguage(browserLanguage()); }, [language]);
  const copy = patientUnavailableCopy[resolvedLanguage];

  return (
    <section lang={patientLanguageTags[resolvedLanguage]} className={`patient-text-surface ${patientTextSizeClassName(patientTextSize)} rounded-xl border border-rose-200 bg-white p-6 shadow-soft`} role="alert">
      <div className="flex justify-end">
        <PatientTextSizeControl language={resolvedLanguage} value={patientTextSize} onChange={setPatientTextSize} />
      </div>
      <span className="mt-5 grid h-12 w-12 place-items-center rounded-lg bg-rose-50 text-coral-text"><AlertTriangle size={25} aria-hidden="true" /></span>
      <h1 className="patient-heading-copy mt-4 font-bold leading-tight text-ink">{copy.title}</h1>
      <p className="patient-body-copy mt-3 font-semibold leading-7 text-text-secondary">{copy.body}</p>
      <div className="patient-body-copy mt-5 flex items-start gap-3 rounded-lg bg-blue-50 px-4 py-4 text-trust-text"><QrCode size={22} className="mt-0.5 shrink-0" aria-hidden="true" /><p className="font-bold leading-7">{copy.recovery}</p></div>
    </section>
  );
}