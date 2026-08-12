import { summarizeSttScores } from "./stt-evaluation";

export type SttEvaluationResultRow = {
  caseId: string;
  condition: "without_prompt" | "with_clinic_prompt";
  expectedText: string;
  transcript: string;
  requiredTerms: Array<string | string[]>;
  riskTags: string[];
  latencyMs: number;
  score: {
    exactNormalized: boolean;
    characterErrorRate: number;
    requiredTermRecall: number;
    missingTerms: string[];
    numberPreserved: boolean;
    clinicalUnitPreserved: boolean;
  };
};

export type SttEvaluationSet = {
  setId: string;
  baselineId: string;
  expectedCaseCount: number;
  rows: SttEvaluationResultRow[];
};

function percentile(values: number[], ratio: number) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.floor((sorted.length - 1) * ratio)];
}

function summarizeRows(rows: SttEvaluationResultRow[]) {
  return {
    ...summarizeSttScores(rows.map((row) => row.score)),
    latencyMs: {
      p50: percentile(rows.map((row) => row.latencyMs), 0.5),
      p95: percentile(rows.map((row) => row.latencyMs), 0.95)
    }
  };
}

export function aggregateSttEvaluationSets(sets: SttEvaluationSet[]) {
  const baselineIds = [...new Set(sets.map((set) => set.baselineId))];
  const setIds = sets.map((set) => set.setId);
  const uniqueSetIds = new Set(setIds);
  const completeSets = sets.every((set) => {
    const withoutRows = set.rows.filter((row) => row.condition === "without_prompt");
    const withRows = set.rows.filter((row) => row.condition === "with_clinic_prompt");
    return withoutRows.length === set.expectedCaseCount &&
      withRows.length === set.expectedCaseCount &&
      new Set(withoutRows.map((row) => row.caseId)).size === set.expectedCaseCount &&
      new Set(withRows.map((row) => row.caseId)).size === set.expectedCaseCount;
  });
  const all = sets.flatMap((set) => set.rows.map((row) => ({ ...row, setId: set.setId })));
  const withoutPrompt = all.filter((row) => row.condition === "without_prompt");
  const withPrompt = all.filter((row) => row.condition === "with_clinic_prompt");
  const withoutSummary = summarizeRows(withoutPrompt);
  const withSummary = summarizeRows(withPrompt);
  const promptedByKey = new Map(withPrompt.map((row) => [`${row.setId}:${row.caseId}`, row]));
  const regressions = withoutPrompt.filter((row) => {
    const prompted = promptedByKey.get(`${row.setId}:${row.caseId}`);
    const beforeSafe = row.score.requiredTermRecall === 1 && row.score.numberPreserved && row.score.clinicalUnitPreserved;
    const afterSafe = prompted
      ? prompted.score.requiredTermRecall === 1 && prompted.score.numberPreserved && prompted.score.clinicalUnitPreserved
      : false;
    return beforeSafe && !afterSafe;
  });
  const failures = withPrompt.filter((row) =>
    row.score.requiredTermRecall !== 1 || !row.score.numberPreserved || !row.score.clinicalUnitPreserved
  );
  const reviews = withPrompt.filter((row) =>
    row.score.requiredTermRecall === 1 && row.score.numberPreserved && row.score.clinicalUnitPreserved && !row.score.exactNormalized
  );
  const latencyOverheadP95Ms = withSummary.latencyMs.p95 - withoutSummary.latencyMs.p95;
  const gates = {
    singleBaseline: baselineIds.length === 1,
    uniqueSetIds: uniqueSetIds.size === setIds.length,
    completeResultPairs: completeSets,
    safetyPassRate100: withSummary.safetyPassRate === 1,
    numberPreservation100: withSummary.numberPreservationRate === 1,
    clinicalUnitPreservation100: withSummary.clinicalUnitPreservationRate === 1,
    requiredTermRecall95: withSummary.meanRequiredTermRecall >= 0.95,
    safetyRegressionZero: regressions.length === 0,
    latencyOverheadP95Within300Ms: latencyOverheadP95Ms <= 300
  };
  const blockingGateKeys = [
    "singleBaseline",
    "uniqueSetIds",
    "completeResultPairs",
    "safetyPassRate100",
    "numberPreservation100",
    "clinicalUnitPreservation100",
    "requiredTermRecall95",
    "safetyRegressionZero"
  ] as const;
  const releaseStatus = blockingGateKeys.every((key) => gates[key])
    ? (gates.latencyOverheadP95Within300Ms ? "pass" : "review")
    : "fail";

  return {
    releaseStatus,
    baselineIds,
    setCount: sets.length,
    utteranceCount: withPrompt.length,
    byCondition: { without_prompt: withoutSummary, with_clinic_prompt: withSummary },
    latencyOverheadP95Ms,
    gates,
    failures,
    reviews,
    regressions,
    bySet: Object.fromEntries(sets.map((set) => [
      set.setId,
      {
        without_prompt: summarizeRows(set.rows.filter((row) => row.condition === "without_prompt")),
        with_clinic_prompt: summarizeRows(set.rows.filter((row) => row.condition === "with_clinic_prompt"))
      }
    ]))
  };
}
