import type { GlossaryEntry, HospitalSpecialty, Prisma } from "@prisma/client";
import {
  clinicGlossary,
  criticalShortPhrases,
  realtimeKoreanTranscriptionHints,
  type ClinicGlossaryData,
  type ClinicGlossaryEntry,
  type CriticalShortPhrase,
  type GlossaryTargetLanguage,
  type VerifiedSentenceEntry
} from "./clinic-glossary";
import { prisma } from "./prisma";

type CacheEntry = {
  timestamp: number;
  data: ClinicGlossaryData;
};

type GlossaryDbEntry = Pick<
  GlossaryEntry,
  "scope" | "specialty" | "hospitalId" | "entryType" | "spokenForms" | "standardKo" | "translations" | "category" | "note" | "priority" | "createdAt"
>;

const cacheTtlMs = 60 * 1000;
const cache = new Map<string, CacheEntry>();

export function glossarySource() {
  return process.env.GLOSSARY_SOURCE === "db" ? "db" : "code";
}

export function getCodeGlossaryData(): ClinicGlossaryData {
  return {
    terms: clinicGlossary,
    criticalPhrases: criticalShortPhrases,
    transcriptionHints: realtimeKoreanTranscriptionHints,
    verifiedSentences: []
  };
}

export function clearGlossaryCache(hospitalId?: string | null, specialty?: HospitalSpecialty | null) {
  if (!hospitalId && !specialty) {
    cache.clear();
    return;
  }

  cache.delete(cacheKey(hospitalId, specialty));
}

function cacheKey(hospitalId?: string | null, specialty?: HospitalSpecialty | null) {
  return `${hospitalId ?? "none"}:${specialty ?? "none"}`;
}

function scopeRank(entry: GlossaryDbEntry) {
  if (entry.scope === "hospital") return 2;
  if (entry.scope === "specialty") return 1;
  return 0;
}

function mergeByScopePrecedence(entries: GlossaryDbEntry[]) {
  const groups = new Map<string, GlossaryDbEntry[]>();
  for (const entry of entries) {
    const key = `${entry.entryType}:${entry.standardKo}`;
    groups.set(key, [...(groups.get(key) ?? []), entry]);
  }

  return Array.from(groups.values()).flatMap((group) => {
    const bestRank = Math.max(...group.map(scopeRank));
    return group.filter((entry) => scopeRank(entry) === bestRank);
  });
}

function sortEntries(entries: GlossaryDbEntry[]) {
  return [...entries].sort((a, b) => {
    if (a.priority !== b.priority) return a.priority - b.priority;
    return a.createdAt.getTime() - b.createdAt.getTime();
  });
}

function jsonObject(value: Prisma.JsonValue) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function stringValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function translatedValue(translations: Record<string, unknown>, key: GlossaryTargetLanguage, fallback: string) {
  if (key === "ko") return fallback;
  if (key === "yue") return stringValue(translations.yue) ?? stringValue(translations.zh_tw) ?? stringValue(translations.zh) ?? fallback;
  if (key === "zh_tw") return stringValue(translations.zh_tw) ?? stringValue(translations.zh) ?? fallback;
  if (key === "ms" || key === "tl") return stringValue(translations[key]) ?? stringValue(translations.id) ?? stringValue(translations.en) ?? fallback;
  return stringValue(translations[key]) ?? stringValue(translations.en) ?? fallback;
}

function toTerm(entry: GlossaryDbEntry): ClinicGlossaryEntry {
  const translations = jsonObject(entry.translations);
  const fallback = stringValue(translations.en) ?? entry.standardKo;

  return {
    spoken: entry.spokenForms,
    standardKo: entry.standardKo,
    zh: translatedValue(translations, "zh", entry.standardKo),
    ja: translatedValue(translations, "ja", fallback),
    en: translatedValue(translations, "en", fallback),
    ru: translatedValue(translations, "ru", fallback),
    vi: translatedValue(translations, "vi", fallback),
    id: translatedValue(translations, "id", fallback),
    category: entry.category ?? "",
    note: entry.note ?? ""
  };
}

function toCriticalPhrase(entry: GlossaryDbEntry): CriticalShortPhrase {
  const translations = jsonObject(entry.translations);
  const en = translatedValue(translations, "en", entry.standardKo);
  const zh = translatedValue(translations, "zh", en);
  const zhTw = translatedValue(translations, "zh_tw", zh);
  const ja = translatedValue(translations, "ja", en);

  return {
    spoken: entry.spokenForms,
    translations: {
      ko: entry.standardKo,
      zh,
      zh_tw: zhTw,
      ja,
      en,
      yue: translatedValue(translations, "yue", zhTw),
      th: stringValue(translations.th),
      ms: stringValue(translations.ms),
      mn: stringValue(translations.mn),
      ru: stringValue(translations.ru),
      vi: stringValue(translations.vi),
      id: stringValue(translations.id),
      tl: stringValue(translations.tl),
      fr: stringValue(translations.fr),
      es: stringValue(translations.es),
      de: stringValue(translations.de),
      it: stringValue(translations.it),
      pt: stringValue(translations.pt)
    },
    note: entry.note ?? ""
  };
}

function toVerifiedSentence(entry: GlossaryDbEntry): VerifiedSentenceEntry {
  const translations = jsonObject(entry.translations);
  const directTranslations: Partial<Record<GlossaryTargetLanguage, string>> = { ko: entry.standardKo };
  for (const key of ["zh", "zh_tw", "yue", "ja", "en", "ru", "vi", "id", "th", "ms", "tl", "mn", "fr", "es", "de", "it", "pt"] as const) {
    const value = stringValue(translations[key]);
    if (value) directTranslations[key] = value;
  }

  return {
    spoken: entry.spokenForms,
    standardKo: entry.standardKo,
    translations: directTranslations,
    category: entry.category ?? "",
    note: entry.note ?? ""
  };
}

function toGlossaryData(entries: GlossaryDbEntry[]): ClinicGlossaryData {
  const mergedEntries = sortEntries(mergeByScopePrecedence(entries));
  return {
    terms: mergedEntries.filter((entry) => entry.entryType === "term").map(toTerm),
    criticalPhrases: mergedEntries.filter((entry) => entry.entryType === "critical_phrase").map(toCriticalPhrase),
    transcriptionHints: mergedEntries
      .filter((entry) => entry.entryType === "transcription_hint")
      .map((entry) => entry.standardKo)
      .filter(Boolean),
    verifiedSentences: mergedEntries.filter((entry) => entry.entryType === "verified_sentence").map(toVerifiedSentence)
  };
}

export async function getGlossaryForHospital(hospitalId?: string | null, specialty?: HospitalSpecialty | null): Promise<ClinicGlossaryData> {
  if (glossarySource() !== "db") return getCodeGlossaryData();

  const key = cacheKey(hospitalId, specialty);
  const now = Date.now();
  const cached = cache.get(key);
  if (cached && now - cached.timestamp < cacheTtlMs) return cached.data;

  try {
    const entries = await prisma.glossaryEntry.findMany({
      where: {
        isActive: true,
        OR: [
          { scope: "global" },
          ...(specialty ? [{ scope: "specialty" as const, specialty }] : []),
          ...(hospitalId ? [{ scope: "hospital" as const, hospitalId }] : [])
        ]
      },
      select: {
        scope: true,
        specialty: true,
        hospitalId: true,
        entryType: true,
        spokenForms: true,
        standardKo: true,
        translations: true,
        category: true,
        note: true,
        priority: true,
        createdAt: true
      }
    });

    const data = toGlossaryData(entries);
    cache.set(key, { timestamp: now, data });
    return data;
  } catch (caught) {
    console.error("[glossary-service] Falling back to code glossary.", caught);
    return getCodeGlossaryData();
  }
}

export async function warmGlossaryForHospital(hospitalId?: string | null, specialty?: HospitalSpecialty | null) {
  await getGlossaryForHospital(hospitalId, specialty);
}
