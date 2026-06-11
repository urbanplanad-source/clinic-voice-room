import { PrismaClient, type GlossaryEntryType, type GlossaryScope, type HospitalSpecialty, type Prisma } from "@prisma/client";
import { clinicGlossary, criticalShortPhrases, realtimeKoreanTranscriptionHints } from "../src/lib/clinic-glossary";
import { specialtyGlossaryEntries } from "../src/lib/specialty-glossary";
import { verifiedSentenceSeedEntries } from "../src/lib/verified-sentence-seed";

const prisma = new PrismaClient();

type ImportEntry = {
  scope: GlossaryScope;
  specialty?: HospitalSpecialty | null;
  hospitalId?: string | null;
  entryType: GlossaryEntryType;
  spokenForms: string[];
  standardKo: string;
  translations: Prisma.InputJsonObject;
  category?: string | null;
  note?: string | null;
  priority: number;
};

type ImportStats = {
  created: number;
  updated: number;
};

function compactTranslations(values: Record<string, string | undefined>) {
  return Object.fromEntries(
    Object.entries(values)
      .map(([key, value]) => [key, value?.trim()] as const)
      .filter((entry): entry is readonly [string, string] => Boolean(entry[1]))
  ) as Prisma.InputJsonObject;
}

function dedupe(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function makeTermEntries(): ImportEntry[] {
  return clinicGlossary.map((entry, index) => ({
    scope: "global",
    specialty: null,
    hospitalId: null,
    entryType: "term",
    spokenForms: dedupe(entry.spoken),
    standardKo: entry.standardKo,
    translations: compactTranslations({
      zh: entry.zh,
      ja: entry.ja,
      en: entry.en,
      ru: entry.ru,
      vi: entry.vi,
      id: entry.id
    }),
    category: entry.category,
    note: entry.note,
    priority: 100 + index
  }));
}

function makeCriticalPhraseEntries(): ImportEntry[] {
  return criticalShortPhrases.map((entry, index) => {
    const { ko, ...translations } = entry.translations;
    return {
      scope: "global",
      specialty: null,
      hospitalId: null,
      entryType: "critical_phrase",
      spokenForms: dedupe(entry.spoken),
      standardKo: ko,
      translations: compactTranslations(translations),
      category: "safety",
      note: entry.note,
      priority: 10 + index
    };
  });
}

function makeTranscriptionHintEntries(): ImportEntry[] {
  return realtimeKoreanTranscriptionHints.map((hint, index) => ({
    scope: "global",
    specialty: null,
    hospitalId: null,
    entryType: "transcription_hint",
    spokenForms: [],
    standardKo: hint,
    translations: {},
    category: "transcription",
    note: "Korean realtime transcription hint",
    priority: 100 + index
  }));
}

function makeSpecialtyTermEntries(): ImportEntry[] {
  return specialtyGlossaryEntries.map((entry, index) => ({
    scope: "specialty",
    specialty: entry.specialty,
    hospitalId: null,
    entryType: "term",
    spokenForms: dedupe(entry.spoken),
    standardKo: entry.standardKo,
    translations: compactTranslations(entry.translations),
    category: entry.category,
    note: entry.note,
    priority: 50 + index
  }));
}

function makeVerifiedSentenceEntries(): ImportEntry[] {
  return verifiedSentenceSeedEntries.map((entry, index) => ({
    scope: "specialty",
    specialty: entry.specialty,
    hospitalId: null,
    entryType: "verified_sentence",
    spokenForms: dedupe(entry.spoken),
    standardKo: entry.standardKo,
    translations: compactTranslations(entry.translations),
    category: entry.category,
    note: entry.note,
    priority: 20 + index
  }));
}

function assertNoImportKeyDuplicates(entries: ImportEntry[]) {
  const seen = new Set<string>();
  const duplicates = new Set<string>();

  for (const entry of entries) {
    const key = importIdentityKey(entry);
    if (seen.has(key)) duplicates.add(key);
    seen.add(key);
  }

  if (duplicates.size > 0) {
    throw new Error(`Duplicate glossary import keys found: ${Array.from(duplicates).slice(0, 10).join(", ")}`);
  }
}

function importIdentityKey(entry: ImportEntry) {
  return [
    entry.scope,
    entry.entryType,
    entry.standardKo,
    entry.category ?? "",
    entry.note ?? "",
    entry.spokenForms.join("|")
  ].join(":");
}

async function upsertImportEntry(entry: ImportEntry) {
  const existing = await prisma.glossaryEntry.findFirst({
    where: {
      scope: entry.scope,
      entryType: entry.entryType,
      standardKo: entry.standardKo,
      category: entry.category ?? null,
      note: entry.note ?? null,
      spokenForms: { equals: entry.spokenForms }
    },
    select: { id: true }
  });

  const data = {
    scope: entry.scope,
    specialty: entry.specialty ?? null,
    hospitalId: entry.hospitalId ?? null,
    entryType: entry.entryType,
    spokenForms: entry.spokenForms,
    standardKo: entry.standardKo,
    translations: entry.translations,
    category: entry.category ?? null,
    note: entry.note ?? null,
    priority: entry.priority,
    isActive: true
  };

  if (existing) {
    await prisma.glossaryEntry.update({
      where: { id: existing.id },
      data
    });
    return "updated" as const;
  }

  await prisma.glossaryEntry.create({ data });
  return "created" as const;
}

async function importGroup(label: string, entries: ImportEntry[]): Promise<ImportStats> {
  const stats: ImportStats = { created: 0, updated: 0 };

  for (const entry of entries) {
    const result = await upsertImportEntry(entry);
    stats[result] += 1;
  }

  console.log(`${label}: expected=${entries.length}, created=${stats.created}, updated=${stats.updated}`);
  return stats;
}

async function main() {
  const termEntries = makeTermEntries();
  const specialtyTermEntries = makeSpecialtyTermEntries();
  const criticalPhraseEntries = makeCriticalPhraseEntries();
  const transcriptionHintEntries = makeTranscriptionHintEntries();
  const verifiedSentenceEntries = makeVerifiedSentenceEntries();
  const allEntries = [...termEntries, ...specialtyTermEntries, ...criticalPhraseEntries, ...transcriptionHintEntries, ...verifiedSentenceEntries];

  assertNoImportKeyDuplicates(allEntries);

  const termStats = await importGroup("term", termEntries);
  const specialtyTermStats = await importGroup("specialty_term", specialtyTermEntries);
  const criticalPhraseStats = await importGroup("critical_phrase", criticalPhraseEntries);
  const transcriptionHintStats = await importGroup("transcription_hint", transcriptionHintEntries);
  const verifiedSentenceStats = await importGroup("verified_sentence", verifiedSentenceEntries);

  const created = termStats.created + specialtyTermStats.created + criticalPhraseStats.created + transcriptionHintStats.created + verifiedSentenceStats.created;
  const updated = termStats.updated + specialtyTermStats.updated + criticalPhraseStats.updated + transcriptionHintStats.updated + verifiedSentenceStats.updated;
  console.log(`Glossary import complete: expected=${allEntries.length}, created=${created}, updated=${updated}`);
}

main()
  .finally(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
