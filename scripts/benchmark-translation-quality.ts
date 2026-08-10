import { performance } from "node:perf_hooks";
import type { ClinicGlossaryData } from "../src/lib/clinic-glossary";
import { compileGlossaryIndex, matchedGlossaryEntryIds } from "../src/lib/compiled-glossary-index";
import { analyzeDeterministicTranslation } from "../src/lib/translation-quality";

const termCount = Number(process.env.QUALITY_BENCHMARK_TERM_COUNT ?? 10_000);
const iterationCount = Number(process.env.QUALITY_BENCHMARK_ITERATIONS ?? 1_000);
const maxP95Ms = Number(process.env.QUALITY_BENCHMARK_MAX_P95_MS ?? 5);

const glossary: ClinicGlossaryData = {
  terms: Array.from({ length: termCount }, (_, index) => ({
    entryId: `term-${index}`,
    spoken: [`병원용어${index}`],
    standardKo: `표준용어${index}`,
    zh: `术语${index}`,
    ja: `用語${index}`,
    en: `term ${index}`,
    ru: `term ${index}`,
    vi: `term ${index}`,
    id: `term ${index}`,
    category: "benchmark",
    note: ""
  })),
  criticalPhrases: [],
  transcriptionHints: [],
  verifiedSentences: [],
  metadata: { glossaryVersion: "benchmark", packVersion: "benchmark", normalizationVersion: 1 }
};

const compileStartedAt = performance.now();
compileGlossaryIndex(glossary);
const compileMs = performance.now() - compileStartedAt;
const samples: number[] = [];

for (let index = 0; index < iterationCount; index += 1) {
  const candidate = index % termCount;
  const startedAt = performance.now();
  matchedGlossaryEntryIds(`표준용어${candidate} 시술을 2회 진행하나요?`, glossary);
  analyzeDeterministicTranslation({
    sourceText: `표준용어${candidate} 시술을 2회 진행하나요?`,
    translatedText: `Is the term ${candidate} procedure performed twice?`,
    direction: "ko_to_patient"
  });
  samples.push(performance.now() - startedAt);
}

samples.sort((a, b) => a - b);
const percentile = (ratio: number) => samples[Math.min(samples.length - 1, Math.floor(samples.length * ratio))] ?? 0;
const report = {
  termCount,
  iterationCount,
  compileMs: Number(compileMs.toFixed(3)),
  lookupAndGuardMs: {
    p50: Number(percentile(0.5).toFixed(3)),
    p95: Number(percentile(0.95).toFixed(3)),
    p99: Number(percentile(0.99).toFixed(3))
  },
  thresholdP95Ms: maxP95Ms
};

console.log(JSON.stringify(report, null, 2));
if (report.lookupAndGuardMs.p95 > maxP95Ms) process.exitCode = 1;

