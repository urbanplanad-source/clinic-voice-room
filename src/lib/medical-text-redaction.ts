import { createHash } from "node:crypto";

export type MedicalTextRedactionResult = {
  text: string;
  redactionTypes: string[];
  containsSensitiveData: boolean;
  sha256: string;
};

const redactionRules: Array<{ type: string; pattern: RegExp; replacement: string }> = [
  { type: "email", pattern: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/giu, replacement: "[이메일]" },
  { type: "phone", pattern: /(?<!\d)(?:\+?82[- .]?)?(?:0?1[016789]|0?2|0?[3-6][1-5])[- .]?\d{3,4}[- .]?\d{4}(?!\d)/gu, replacement: "[전화번호]" },
  { type: "resident_id", pattern: /(?<!\d)\d{6}[- ]?[1-8]\d{6}(?!\d)/gu, replacement: "[식별번호]" },
  { type: "record_id", pattern: /(?:환자|예약|접수|차트|등록|patient|reservation|chart|record)\s*(?:번호|no\.?|id)?\s*[:=#-]?\s*[A-Z0-9-]{4,}/giu, replacement: "[기록번호]" },
  { type: "name", pattern: /(?:이름|성명|환자명|name)\s*[:=]\s*[\p{L}][\p{L} .'-]{1,40}/giu, replacement: "[이름]" }
];

export function hashMedicalText(text: string) {
  return createHash("sha256").update(text.normalize("NFKC").trim()).digest("hex");
}

export function deidentifyMedicalText(value: string): MedicalTextRedactionResult {
  const original = value.normalize("NFKC").replace(/\s+/g, " ").trim();
  const redactionTypes: string[] = [];
  let text = original;
  for (const rule of redactionRules) {
    if (!rule.pattern.test(text)) continue;
    rule.pattern.lastIndex = 0;
    text = text.replace(rule.pattern, rule.replacement);
    redactionTypes.push(rule.type);
  }
  return {
    text,
    redactionTypes: Array.from(new Set(redactionTypes)),
    containsSensitiveData: redactionTypes.length > 0,
    sha256: hashMedicalText(original)
  };
}
