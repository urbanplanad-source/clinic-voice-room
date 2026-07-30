import type { GlossaryEntryType, Prisma } from "@prisma/client";
import { findGlossaryAliasConflict } from "../src/lib/glossary-service";
import { prisma } from "../src/lib/prisma";

type ReviewedAlias = {
  standardKo: string;
  spokenForms: string[];
  translations: Prisma.InputJsonObject;
  category: string;
  note: string;
};

const reviewedAliases: ReviewedAlias[] = [
  {
    standardKo: "울쎄라",
    spokenForms: ["울쎄라", "울세라", "울셀라", "올셀라", "웃음세라", "울새나"],
    translations: {
      zh: "Ultherapy",
      ja: "ウルセラ",
      en: "Ultherapy",
      ru: "Ultherapy",
      vi: "Ultherapy",
      id: "Ultherapy"
    },
    category: "device",
    note: "장비명 의역 금지"
  },
  {
    standardKo: "리쥬란",
    spokenForms: ["리쥬란", "리주란", "미주란"],
    translations: {
      zh: "丽珠兰",
      ja: "リジュラン",
      en: "Rejuran",
      ru: "Rejuran",
      vi: "Rejuran",
      id: "Rejuran"
    },
    category: "brand",
    note: "브랜드명"
  },
  {
    standardKo: "울쎄라피 프라임",
    spokenForms: ["울쎄라피프라임", "울쎄라 프라임", "울세라피 프라임", "울쎄라 핏 프라임"],
    translations: {
      zh: "Ultherapy Prime",
      ja: "ウルセラピー プライム",
      en: "Ultherapy Prime",
      ru: "Ultherapy Prime",
      vi: "Ultherapy Prime",
      id: "Ultherapy Prime"
    },
    category: "device",
    note: "장비명 의역 금지"
  },
  {
    standardKo: "켈로이드",
    spokenForms: ["켈로이드", "켄루이드"],
    translations: {
      zh: "瘢痕疙瘩",
      ja: "ケロイド",
      en: "keloid",
      ru: "келоид",
      vi: "sẹo lồi",
      id: "keloid"
    },
    category: "medical",
    note: "의학용어"
  }
];

function dedupe(values: string[]) {
  const seen = new Set<string>();
  return values.filter((value) => {
    const trimmed = value.trim();
    const key = trimmed.normalize("NFKC").toLocaleLowerCase("ko-KR").replace(/\s+/g, "");
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function assertNoConflicts(entry: ReviewedAlias) {
  const conflict = await findGlossaryAliasConflict({
    entryType: "transcription_hint",
    standardKo: entry.standardKo,
    spokenForms: entry.spokenForms
  });
  if (conflict) {
    throw new Error(
      `Cannot map '${conflict.spokenForm}' to '${entry.standardKo}'; it is already mapped to '${conflict.standardKo}'.`
    );
  }
}

async function mergeEntry(database: Prisma.TransactionClient, entry: ReviewedAlias, entryType: GlossaryEntryType) {
  const existingRows = await database.glossaryEntry.findMany({
    where: {
      scope: "global",
      hospitalId: null,
      entryType,
      standardKo: entry.standardKo,
      isActive: true
    },
    orderBy: [{ priority: "asc" }, { createdAt: "asc" }],
    select: { id: true, spokenForms: true, priority: true }
  });

  if (existingRows.length === 0) {
    await database.glossaryEntry.create({
      data: {
        scope: "global",
        specialty: null,
        hospitalId: null,
        entryType,
        spokenForms: entry.spokenForms,
        standardKo: entry.standardKo,
        translations: entryType === "term" ? entry.translations : {},
        category: entryType === "term" ? entry.category : "transcription",
        note: entryType === "term" ? entry.note : "Reviewed Korean STT alias",
        priority: 90,
        isActive: true
      }
    });
    return { created: 1, updated: 0, unchanged: 0 };
  }

  let updated = 0;
  let unchanged = 0;
  for (const row of existingRows) {
    const spokenForms = dedupe([...row.spokenForms, ...entry.spokenForms]);
    const priority = Math.min(row.priority, 90);
    if (JSON.stringify(spokenForms) === JSON.stringify(row.spokenForms) && priority === row.priority) {
      unchanged += 1;
      continue;
    }
    await database.glossaryEntry.update({
      where: { id: row.id },
      data: { spokenForms, priority }
    });
    updated += 1;
  }
  return { created: 0, updated, unchanged };
}

async function main() {
  for (const entry of reviewedAliases) await assertNoConflicts(entry);

  const totals = { created: 0, updated: 0, unchanged: 0 };
  await prisma.$transaction(async (transaction) => {
    for (const entry of reviewedAliases) {
      for (const entryType of ["term", "transcription_hint"] as const) {
        const result = await mergeEntry(transaction, entry, entryType);
        totals.created += result.created;
        totals.updated += result.updated;
        totals.unchanged += result.unchanged;
        console.log(`${entry.standardKo} (${entryType}): ${JSON.stringify(result)}`);
      }
    }
  });
  console.log(`Reviewed STT alias merge complete: ${JSON.stringify(totals)}`);
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
