import type { GlossaryEntry, HospitalSpecialty, Prisma } from "@prisma/client";
import { createHash } from "node:crypto";
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
import {
  findClinicTranscriptionAliasConflict,
  transcriptionMappingsFromTerms,
  type ClinicTranscriptionHintMapping
} from "./clinic-transcription";
import { prisma } from "./prisma";
import { compileGlossaryIndex } from "./compiled-glossary-index";

type CacheEntry = {
  timestamp: number;
  data: ClinicGlossaryData;
};

type GlossaryDbEntry = Pick<
  GlossaryEntry,
  "id" | "scope" | "specialty" | "hospitalId" | "entryType" | "spokenForms" | "standardKo" | "translations" | "category" | "note" | "priority" | "version" | "createdAt" | "updatedAt"
>;

const cacheTtlMs = 60 * 1000;
const cache = new Map<string, CacheEntry>();
let compiledCodeGlossaryData: ClinicGlossaryData | null = null;

export function glossarySource() {
  return process.env.GLOSSARY_SOURCE === "db" ? "db" : "code";
}

export function getCodeGlossaryData(): ClinicGlossaryData {
  if (compiledCodeGlossaryData) return compiledCodeGlossaryData;
  const data: ClinicGlossaryData = {
    terms: clinicGlossary,
    criticalPhrases: criticalShortPhrases,
    transcriptionHints: realtimeKoreanTranscriptionHints,
    transcriptionHintMappings: transcriptionMappingsFromTerms(clinicGlossary),
    verifiedSentences: [],
    metadata: { glossaryVersion: "code-v1", packVersion: "code-v1", normalizationVersion: 1 }
  };
  compileGlossaryIndex(data);
  compiledCodeGlossaryData = data;
  return data;
}

export function clearGlossaryCache(hospitalId?: string | null, specialty?: HospitalSpecialty | null) {
  if (!hospitalId && !specialty) {
    cache.clear();
    return;
  }

  for (const key of cache.keys()) {
    if (shouldInvalidateGlossaryCacheKey(key, hospitalId, specialty)) cache.delete(key);
  }
}

function cacheKey(hospitalId?: string | null, specialty?: HospitalSpecialty | null) {
  return `${hospitalId ?? "none"}:${specialty ?? "none"}`;
}

export function shouldInvalidateGlossaryCacheKey(
  key: string,
  hospitalId?: string | null,
  specialty?: HospitalSpecialty | null
) {
  if (!hospitalId && !specialty) return true;
  const [cachedHospitalId, cachedSpecialty] = key.split(":");
  return Boolean(
    (hospitalId && cachedHospitalId === hospitalId) ||
    (specialty && cachedSpecialty === specialty)
  );
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
    entryId: entry.id,
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
    entryId: entry.id,
    spoken: entry.spokenForms,
    standardKo: entry.standardKo,
    translations: directTranslations,
    category: entry.category ?? "",
    note: entry.note ?? ""
  };
}

function toGlossaryData(entries: GlossaryDbEntry[]): ClinicGlossaryData {
  const mergedEntries = sortEntries(mergeByScopePrecedence(entries));
  const terms = mergedEntries.filter((entry) => entry.entryType === "term").map(toTerm);
  const transcriptionEntries = mergedEntries.filter((entry) => entry.entryType === "transcription_hint");
  const explicitMappings: ClinicTranscriptionHintMapping[] = transcriptionEntries.map((entry) => ({
    standardKo: entry.standardKo,
    spokenForms: entry.spokenForms,
    category: entry.category ?? undefined,
    priority: entry.priority,
    source: "transcription_hint"
  }));
  const versionDigest = createHash("sha256")
    .update(entries.map((entry) => `${entry.id}:${entry.version}:${entry.updatedAt.toISOString()}`).sort().join("|"))
    .digest("hex")
    .slice(0, 20);
  const data: ClinicGlossaryData = {
    terms,
    criticalPhrases: mergedEntries.filter((entry) => entry.entryType === "critical_phrase").map(toCriticalPhrase),
    transcriptionHints: transcriptionEntries.map((entry) => entry.standardKo).filter(Boolean),
    transcriptionHintMappings: [...explicitMappings, ...transcriptionMappingsFromTerms(terms)],
    verifiedSentences: mergedEntries.filter((entry) => entry.entryType === "verified_sentence").map(toVerifiedSentence),
    metadata: {
      glossaryVersion: `gl-${versionDigest}`,
      packVersion: `pack-${versionDigest}`,
      normalizationVersion: 1
    }
  };
  compileGlossaryIndex(data);
  return data;
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
        id: true,
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
        version: true,
        createdAt: true,
        updatedAt: true
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

export async function findGlossaryAliasConflict(input: {
  entryType: "term" | "critical_phrase" | "transcription_hint" | "verified_sentence";
  standardKo: string;
  spokenForms: string[];
  excludeId?: string;
}, database: typeof prisma | Prisma.TransactionClient = prisma) {
  if (!(["term", "transcription_hint"] as const).includes(input.entryType as "term" | "transcription_hint")) return null;
  const spokenForms = [...new Set(input.spokenForms.map((value) => value.trim()).filter(Boolean))];
  if (spokenForms.length === 0) return null;

  const rows = await database.glossaryEntry.findMany({
    where: {
      isActive: true,
      entryType: { in: ["term", "transcription_hint"] },
      ...(input.excludeId ? { id: { not: input.excludeId } } : {})
    },
    select: { id: true, standardKo: true, spokenForms: true }
  });
  return findClinicTranscriptionAliasConflict(input.standardKo, spokenForms, rows);
}
