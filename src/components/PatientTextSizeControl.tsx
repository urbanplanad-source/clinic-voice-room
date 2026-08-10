"use client";

import { useEffect, useState } from "react";
import { Type } from "lucide-react";
import type { PatientLanguage } from "@/lib/languages";

export type PatientTextSize = "default" | "large" | "largest";

const storageKey = "medivoice:patient-text-size";

export const patientTextSizeCopy: Record<PatientLanguage, { label: string; default: string; large: string; largest: string }> = {
  zh: { label: "文字大小", default: "标准", large: "大", largest: "最大" },
  yue: { label: "文字大小", default: "標準", large: "大", largest: "最大" },
  zh_tw: { label: "文字大小", default: "標準", large: "大", largest: "最大" },
  ja: { label: "文字サイズ", default: "標準", large: "大", largest: "最大" },
  en: { label: "Text size", default: "Standard", large: "Large", largest: "Largest" },
  th: { label: "ขนาดตัวอักษร", default: "มาตรฐาน", large: "ใหญ่", largest: "ใหญ่ที่สุด" },
  vi: { label: "Cỡ chữ", default: "Chuẩn", large: "Lớn", largest: "Lớn nhất" },
  id: { label: "Ukuran teks", default: "Standar", large: "Besar", largest: "Terbesar" },
  ms: { label: "Saiz teks", default: "Standard", large: "Besar", largest: "Terbesar" },
  tl: { label: "Laki ng teksto", default: "Karaniwan", large: "Malaki", largest: "Pinakamalaki" },
  mn: { label: "Үсгийн хэмжээ", default: "Стандарт", large: "Том", largest: "Хамгийн том" },
  ru: { label: "Размер текста", default: "Обычный", large: "Крупный", largest: "Самый крупный" },
  fr: { label: "Taille du texte", default: "Standard", large: "Grand", largest: "Très grand" },
  es: { label: "Tamaño del texto", default: "Estándar", large: "Grande", largest: "Muy grande" },
  de: { label: "Textgröße", default: "Standard", large: "Groß", largest: "Sehr groß" },
  it: { label: "Dimensione testo", default: "Standard", large: "Grande", largest: "Molto grande" },
  pt: { label: "Tamanho do texto", default: "Padrão", large: "Grande", largest: "Muito grande" }
};

function storedTextSize(): PatientTextSize {
  if (typeof window === "undefined") return "default";
  const value = window.localStorage.getItem(storageKey);
  return value === "large" || value === "largest" ? value : "default";
}

export function usePatientTextSize() {
  const [textSize, setTextSize] = useState<PatientTextSize>(storedTextSize);

  useEffect(() => {
    window.localStorage.setItem(storageKey, textSize);
  }, [textSize]);

  return [textSize, setTextSize] as const;
}

export function patientTextSizeClassName(textSize: PatientTextSize) {
  return textSize === "large" ? "patient-text-large" : textSize === "largest" ? "patient-text-largest" : "patient-text-default";
}

export function PatientTextSizeControl({ language, value, onChange }: { language: PatientLanguage; value: PatientTextSize; onChange: (value: PatientTextSize) => void }) {
  const copy = patientTextSizeCopy[language];
  const options: Array<{ value: PatientTextSize; label: string; visual: string }> = [
    { value: "default", label: copy.default, visual: "A" },
    { value: "large", label: copy.large, visual: "A+" },
    { value: "largest", label: copy.largest, visual: "A++" }
  ];

  return (
    <div className="inline-flex min-h-11 items-center gap-1 rounded-lg border border-line-strong bg-white p-1 shadow-sm" role="group" aria-label={copy.label}>
      <span className="sr-only">{copy.label}</span>
      <Type size={17} className="mx-1 shrink-0 text-text-secondary" aria-hidden="true" />
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button key={option.value} type="button" onClick={() => onChange(option.value)} aria-pressed={selected} aria-label={`${copy.label}: ${option.label}`} className={`min-h-9 min-w-11 rounded-md px-2 text-sm font-bold ${selected ? "bg-ink text-white" : "bg-white text-text-secondary hover:bg-surface-muted"}`}>
            {option.visual}
          </button>
        );
      })}
    </div>
  );
}