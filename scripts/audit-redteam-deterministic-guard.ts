import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { analyzeDeterministicTranslation } from "../src/lib/translation-quality";
import type { TranslationLanguage } from "../src/lib/languages";

type RedteamCase = {
  caseId: string;
  specialty: string;
  sourceLanguage: TranslationLanguage;
  targetLanguage: TranslationLanguage;
  sourceText: string;
  expectedTranslation: string;
  primaryRiskType: string;
  riskTags: string[];
  riskLevel: string;
  referenceStatus: string;
};

function argument(name: string, fallback: string) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] ?? fallback : fallback;
}

function countBy(values: string[]) {
  return Object.fromEntries(
    Array.from(new Set(values)).sort().map((value) => [
      value,
      values.filter((candidate) => candidate === value).length
    ])
  );
}

async function main() {
  const inputPath = resolve(argument("input", "quality/results/ultra-translation-case-source.jsonl"));
  const outputPath = resolve(argument("output", "quality/results/playstore-candidate-deterministic-audit.jsonl"));
  const summaryPath = resolve(argument("summary", "quality/results/playstore-candidate-deterministic-audit-summary.json"));
  const rows = (await readFile(inputPath, "utf8"))
    .split(/\r?\n/u)
    .filter(Boolean)
    .map((line) => JSON.parse(line) as RedteamCase);

  const results = rows.map((row) => {
    const direction = row.sourceLanguage === "ko" ? "ko_to_patient" as const : "patient_to_ko" as const;
    const check = analyzeDeterministicTranslation({
      sourceText: row.sourceText,
      translatedText: row.expectedTranslation,
      direction,
      targetLanguage: row.targetLanguage
    });
    return {
      caseId: row.caseId,
      specialty: row.specialty,
      languagePair: `${row.sourceLanguage}->${row.targetLanguage}`,
      riskLevel: row.riskLevel,
      primaryRiskType: row.primaryRiskType,
      riskTags: row.riskTags,
      referenceStatus: row.referenceStatus,
      status: check.status,
      falsePositiveCandidate: check.status === "fail",
      failureReasons: check.failureReasons,
      checks: {
        numberPreserved: check.numberPreserved,
        clinicalUnitPreserved: check.clinicalUnitPreserved,
        targetLanguagePreserved: check.targetLanguagePreserved,
        questionPreserved: check.questionPreserved,
        negationPreserved: check.negationPreserved,
        brandPreserved: check.brandPreserved
      }
    };
  });
  const failed = results.filter((row) => row.status === "fail");
  const summary = {
    createdAt: new Date().toISOString(),
    inputPath,
    outputPath,
    sourceCaseCount: rows.length,
    referencePolicy: "synthetic_unapproved references; failures are false-positive candidates, not proven rule defects",
    passCount: results.length - failed.length,
    failCount: failed.length,
    passRate: Number(((results.length - failed.length) / Math.max(1, results.length)).toFixed(4)),
    failuresByReason: countBy(failed.flatMap((row) => row.failureReasons)),
    failuresBySpecialty: countBy(failed.map((row) => row.specialty)),
    failuresByLanguagePair: countBy(failed.map((row) => row.languagePair)),
    failedCaseIds: failed.map((row) => row.caseId)
  };
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, results.map((row) => JSON.stringify(row)).join("\n") + "\n", "utf8");
  await writeFile(summaryPath, JSON.stringify(summary, null, 2) + "\n", "utf8");
  console.log(JSON.stringify(summary, null, 2));
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
