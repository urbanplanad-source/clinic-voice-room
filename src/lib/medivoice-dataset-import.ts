export const medivoiceDatasetSpecialties = ["dermatology", "plastic_surgery", "oriental_medicine"] as const;

export type MedivoiceDatasetSpecialty = (typeof medivoiceDatasetSpecialties)[number];
export type DatasetIssueSeverity = "blocker" | "review" | "info";
export type DatasetAssetType = "term" | "critical_phrase" | "verified_sentence";

export type DatasetWorkbookSheet = {
  sheet: string;
  data: unknown[][];
};

export type DatasetWorkbookInput = {
  fileName: string;
  expectedSpecialty?: MedivoiceDatasetSpecialty;
  sheets: DatasetWorkbookSheet[];
};

export type DatasetIssue = {
  id: string;
  severity: DatasetIssueSeverity;
  code: string;
  specialty?: MedivoiceDatasetSpecialty;
  sourceId?: string;
  message: string;
};

export type DatasetAssetCandidate = {
  key: string;
  assetType: DatasetAssetType;
  scope: "global" | "specialty";
  specialty: MedivoiceDatasetSpecialty | null;
  sourceIds: string[];
  standardKo: string;
  spokenForms: string[];
  category: string;
  riskLevel: string;
  speechAct: string;
  direction: string;
  requiredTerms: string[];
  forbiddenChanges: string[];
  evidenceIds: string[];
  promotionReady: false;
  readinessReason: string;
};

export type DatasetNumericTest = {
  key: string;
  specialty: MedivoiceDatasetSpecialty;
  sourceId: string;
  scenario: string;
  templateKo: string;
  requiredTerms: string[];
  forbiddenChanges: string[];
  invariantTokens: string[];
  note: string;
};

export type DatasetMergeGroup = {
  key: string;
  kind: "term" | "sentence";
  standardKo: string;
  specialties: MedivoiceDatasetSpecialty[];
  sourceIds: string[];
  suggestedScope: "global";
};

export type DatasetFileSummary = {
  fileName: string;
  specialty: MedivoiceDatasetSpecialty;
  sheetNames: string[];
  sourceCount: number;
  glossaryCount: number;
  numericTestCount: number;
  sourceReviewPendingCount: number;
  humanApprovalPendingCount: number;
  glossaryReviewPendingCount: number;
};

export type DatasetDryRunResult = {
  summary: {
    fileCount: number;
    sourceSentenceCount: number;
    glossaryTermCount: number;
    numericTestCount: number;
    highCriticalCount: number;
    sttMappingCount: number;
    globalMergeGroupCount: number;
    databaseReadyCount: number;
    sourceReviewPendingCount: number;
    humanApprovalPendingCount: number;
    glossaryReviewPendingCount: number;
    blockerCount: number;
    reviewCount: number;
  };
  files: DatasetFileSummary[];
  candidates: DatasetAssetCandidate[];
  numericTests: DatasetNumericTest[];
  mergeGroups: DatasetMergeGroup[];
  issues: DatasetIssue[];
};

type RowRecord = Record<string, unknown> & { __row: number };

type ParsedSource = {
  specialty: MedivoiceDatasetSpecialty;
  id: string;
  standardKo: string;
  spokenForms: string[];
  category: string;
  riskLevel: string;
  riskType: string;
  speechAct: string;
  direction: string;
  requiredTerms: string[];
  forbiddenChanges: string[];
  evidenceIds: string[];
  sourceQaStatus: string;
  humanApproved: boolean;
};

type ParsedGlossary = {
  specialty: MedivoiceDatasetSpecialty;
  id: string;
  standardKo: string;
  spokenForms: string[];
  category: string;
  riskLevel: string;
  evidenceIds: string[];
  officialEnglishTerm: string;
  reviewRequired: boolean;
};

const specialtyLabels: Record<MedivoiceDatasetSpecialty, string> = {
  dermatology: "피부과",
  plastic_surgery: "성형외과",
  oriental_medicine: "한의원"
};

const requiredSourceHeaders = [
  "sentence_id", "scenario", "speaker", "direction", "speech_act", "standard_ko",
  "primary_risk_type", "risk_level", "required_terms", "forbidden_changes",
  "source_qa_status", "evidence_id", "human_approved", "release_status"
];

const requiredGlossaryHeaders = [
  "glossary_id", "standard_ko", "spoken_aliases_ko", "official_english_term",
  "risk_level", "evidence_id", "review_required"
];

const blankAliases = new Set(["", "없음", "none", "n/a", "해당 없음"]);

function text(value: unknown) {
  if (value instanceof Date) return value.toISOString();
  return value === null || value === undefined ? "" : String(value).trim();
}

export function normalizeDatasetText(value: string) {
  return value.normalize("NFKC").toLocaleLowerCase().replace(/[\s\p{P}\p{S}]+/gu, "");
}

function unique(values: string[]) {
  const seen = new Set<string>();
  return values.filter((value) => {
    const trimmed = value.trim().replace(/\s+/g, " ");
    const key = normalizeDatasetText(trimmed);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  }).map((value) => value.trim().replace(/\s+/g, " "));
}

function splitList(value: unknown, includeCommas = false) {
  const pattern = includeCommas ? /[;,|\n]+/u : /[;|\n]+/u;
  return unique(text(value).split(pattern).map((item) => item.trim()).filter(Boolean));
}

function splitAliases(value: unknown) {
  return splitList(value, true).filter((item) => !blankAliases.has(item.toLocaleLowerCase()));
}

function booleanValue(value: unknown) {
  return ["true", "1", "yes", "y"].includes(text(value).toLocaleLowerCase());
}

function sheetRecords(sheet: DatasetWorkbookSheet | undefined) {
  if (!sheet?.data.length) return { headers: [] as string[], rows: [] as RowRecord[] };
  const headers = sheet.data[0].map(text);
  const rows = sheet.data.slice(1)
    .filter((row) => row.some((value) => text(value)))
    .map((row, index) => ({
      __row: index + 2,
      ...Object.fromEntries(headers.map((header, column) => [header, row[column] ?? null]))
    }) as RowRecord);
  return { headers, rows };
}

function inferSpecialty(workbook: DatasetWorkbookInput, sourceRows: RowRecord[]) {
  if (workbook.expectedSpecialty) return workbook.expectedSpecialty;
  const hint = `${workbook.fileName} ${sourceRows.slice(0, 5).map((row) => text(row.specialty)).join(" ")}`;
  if (/성형외과/u.test(hint)) return "plastic_surgery" as const;
  if (/피부과/u.test(hint)) return "dermatology" as const;
  if (/한의원|한의학/u.test(hint)) return "oriental_medicine" as const;
  return null;
}

function addMissingHeaderIssues(
  issues: DatasetIssue[],
  specialty: MedivoiceDatasetSpecialty,
  sheetName: string,
  headers: string[],
  requiredHeaders: string[]
) {
  for (const header of requiredHeaders.filter((required) => !headers.includes(required))) {
    issues.push({
      id: `missing-header:${specialty}:${sheetName}:${header}`,
      severity: "blocker",
      code: "missing_header",
      specialty,
      message: `${specialtyLabels[specialty]} ${sheetName} 시트에 ${header} 열이 없습니다.`
    });
  }
}

function sourceAssetType(source: ParsedSource): DatasetAssetType {
  const safetyType = /emergency|allergy|bleeding|infection|consent|respiratory|medication|implant|pregnancy/iu.test(source.riskType);
  if (source.riskLevel === "critical" || (safetyType && ["warning", "instruction", "request"].includes(source.speechAct))) {
    return "critical_phrase";
  }
  return "verified_sentence";
}

function groupByNormalized<T>(rows: T[], value: (row: T) => string) {
  const groups = new Map<string, T[]>();
  for (const row of rows) {
    const key = normalizeDatasetText(value(row));
    if (!key) continue;
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }
  return groups;
}

export function analyzeMedivoiceDatasets(workbooks: DatasetWorkbookInput[]): DatasetDryRunResult {
  const issues: DatasetIssue[] = [];
  const files: DatasetFileSummary[] = [];
  const sources: ParsedSource[] = [];
  const glossaryRows: ParsedGlossary[] = [];
  const numericTests: DatasetNumericTest[] = [];
  const seenSpecialties = new Set<MedivoiceDatasetSpecialty>();

  if (workbooks.length !== 3) {
    issues.push({
      id: "file-count",
      severity: "blocker",
      code: "file_count",
      message: `피부과·성형외과·한의원 파일 3개가 필요합니다. 현재 ${workbooks.length}개입니다.`
    });
  }

  for (const workbook of workbooks) {
    const sheetMap = new Map(workbook.sheets.map((sheet) => [sheet.sheet.trim(), sheet]));
    const sourceSheet = sheetRecords(sheetMap.get("source_master"));
    const glossarySheet = sheetRecords(sheetMap.get("glossary"));
    const numericSheet = sheetRecords(sheetMap.get("numeric_test_candidates"));
    const specialty = inferSpecialty(workbook, sourceSheet.rows);

    if (!specialty) {
      issues.push({ id: `unknown-specialty:${workbook.fileName}`, severity: "blocker", code: "unknown_specialty", message: `${workbook.fileName}의 진료과를 판별하지 못했습니다.` });
      continue;
    }
    if (seenSpecialties.has(specialty)) {
      issues.push({ id: `duplicate-specialty:${specialty}`, severity: "blocker", code: "duplicate_specialty", specialty, message: `${specialtyLabels[specialty]} 파일이 두 번 선택됐습니다.` });
    }
    seenSpecialties.add(specialty);

    for (const requiredSheet of ["source_master", "glossary"]) {
      if (!sheetMap.has(requiredSheet)) {
        issues.push({ id: `missing-sheet:${specialty}:${requiredSheet}`, severity: "blocker", code: "missing_sheet", specialty, message: `${specialtyLabels[specialty]} 파일에 ${requiredSheet} 시트가 없습니다.` });
      }
    }
    addMissingHeaderIssues(issues, specialty, "source_master", sourceSheet.headers, requiredSourceHeaders);
    addMissingHeaderIssues(issues, specialty, "glossary", glossarySheet.headers, requiredGlossaryHeaders);
    if (!sheetMap.has("numeric_test_candidates")) {
      issues.push({ id: `numeric-missing:${specialty}`, severity: "info", code: "numeric_sheet_missing", specialty, message: `${specialtyLabels[specialty]}에는 숫자·단위 테스트 시트가 없습니다. 추후 보완 대상으로 유지합니다.` });
    }

    let sourceReviewPendingCount = 0;
    let humanApprovalPendingCount = 0;
    let glossaryReviewPendingCount = 0;
    const sourceIds = new Set<string>();
    for (const row of sourceSheet.rows) {
      const id = text(row.sentence_id);
      const standardKo = text(row.standard_ko);
      if (!id || !standardKo) {
        issues.push({ id: `source-required:${specialty}:${row.__row}`, severity: "blocker", code: "missing_required_value", specialty, sourceId: id || `row-${row.__row}`, message: `${specialtyLabels[specialty]} source_master ${row.__row}행의 ID 또는 기준문장이 비어 있습니다.` });
        continue;
      }
      if (sourceIds.has(id)) {
        issues.push({ id: `source-id-duplicate:${specialty}:${id}`, severity: "blocker", code: "duplicate_source_id", specialty, sourceId: id, message: `${specialtyLabels[specialty]}에서 ${id}가 중복됩니다.` });
      }
      sourceIds.add(id);
      const parsed: ParsedSource = {
        specialty,
        id,
        standardKo,
        spokenForms: splitList(row.spoken_variants_ko),
        category: text(row.scenario) || text(row.subcategory) || "dataset_sentence",
        riskLevel: text(row.risk_level).toLocaleLowerCase(),
        riskType: text(row.primary_risk_type),
        speechAct: text(row.speech_act).toLocaleLowerCase(),
        direction: text(row.direction),
        requiredTerms: splitList(row.required_terms),
        forbiddenChanges: splitList(row.forbidden_changes),
        evidenceIds: splitList(row.evidence_id, true),
        sourceQaStatus: text(row.source_qa_status).toLocaleLowerCase(),
        humanApproved: booleanValue(row.human_approved)
      };
      sources.push(parsed);
      if (parsed.sourceQaStatus === "review") sourceReviewPendingCount += 1;
      if (!parsed.humanApproved) humanApprovalPendingCount += 1;
      if (parsed.sourceQaStatus === "fail") {
        issues.push({ id: `source-fail:${specialty}:${id}`, severity: "blocker", code: "failed_source", specialty, sourceId: id, message: `${id}는 source_qa_status=fail이므로 승격 후보에서 제외해야 합니다.` });
      }
      if (["high", "critical"].includes(parsed.riskLevel) && (!parsed.requiredTerms.length || !parsed.forbiddenChanges.length)) {
        issues.push({ id: `safety-rule-missing:${specialty}:${id}`, severity: "review", code: "missing_safety_rule", specialty, sourceId: id, message: `${id}는 ${parsed.riskLevel} 위험 문장이지만 필수어 또는 금지변형 규칙이 비어 있습니다.` });
      }
    }

    const glossaryIds = new Set<string>();
    for (const row of glossarySheet.rows) {
      const id = text(row.glossary_id);
      const standardKo = text(row.standard_ko);
      if (!id || !standardKo) {
        issues.push({ id: `glossary-required:${specialty}:${row.__row}`, severity: "blocker", code: "missing_required_value", specialty, sourceId: id || `row-${row.__row}`, message: `${specialtyLabels[specialty]} glossary ${row.__row}행의 ID 또는 표준용어가 비어 있습니다.` });
        continue;
      }
      if (glossaryIds.has(id)) {
        issues.push({ id: `glossary-id-duplicate:${specialty}:${id}`, severity: "blocker", code: "duplicate_glossary_id", specialty, sourceId: id, message: `${specialtyLabels[specialty]}에서 ${id}가 중복됩니다.` });
      }
      glossaryIds.add(id);
      glossaryRows.push({
        specialty,
        id,
        standardKo,
        spokenForms: splitAliases(row.spoken_aliases_ko),
        category: text(row.usage_context) || "dataset_term",
        riskLevel: text(row.risk_level).toLocaleLowerCase(),
        evidenceIds: splitList(row.evidence_id, true),
        officialEnglishTerm: text(row.official_english_term),
        reviewRequired: booleanValue(row.review_required)
      });
      if (booleanValue(row.review_required)) glossaryReviewPendingCount += 1;
    }

    for (const row of numericSheet.rows) {
      const id = text(row.candidate_id);
      if (!id) continue;
      numericTests.push({
        key: `${specialty}:${id}`,
        specialty,
        sourceId: id,
        scenario: text(row.scenario),
        templateKo: text(row.standard_ko_slot) || text(row.synthetic_test_input_ko),
        requiredTerms: splitList(row.required_terms),
        forbiddenChanges: splitList(row.forbidden_changes),
        invariantTokens: splitList(row.invariant_tokens, true),
        note: text(row.qa_note_ko) || text(row.test_data_warning)
      });
    }

    if (sourceReviewPendingCount > 0) {
      issues.push({
        id: `source-review-pending:${specialty}`,
        severity: "review",
        code: "source_review_pending",
        specialty,
        message: `${specialtyLabels[specialty]} 기준문장 ${sourceReviewPendingCount}건이 source_qa_status=review 상태입니다.`
      });
    }
    if (humanApprovalPendingCount > 0) {
      issues.push({
        id: `human-approval-pending:${specialty}`,
        severity: "review",
        code: "human_approval_pending",
        specialty,
        message: `${specialtyLabels[specialty]} 기준문장 ${humanApprovalPendingCount}건이 아직 사람 승인 전입니다.`
      });
    }
    if (glossaryReviewPendingCount > 0) {
      issues.push({
        id: `glossary-review-pending:${specialty}`,
        severity: "review",
        code: "glossary_review_pending",
        specialty,
        message: `${specialtyLabels[specialty]} 용어 ${glossaryReviewPendingCount}건에 사람 검토가 필요합니다.`
      });
    }

    files.push({
      fileName: workbook.fileName,
      specialty,
      sheetNames: workbook.sheets.map((sheet) => sheet.sheet),
      sourceCount: sourceSheet.rows.length,
      glossaryCount: glossarySheet.rows.length,
      numericTestCount: numericSheet.rows.length,
      sourceReviewPendingCount,
      humanApprovalPendingCount,
      glossaryReviewPendingCount
    });
  }

  for (const specialty of medivoiceDatasetSpecialties) {
    if (!seenSpecialties.has(specialty)) {
      issues.push({ id: `specialty-missing:${specialty}`, severity: "blocker", code: "specialty_missing", specialty, message: `${specialtyLabels[specialty]} 데이터셋이 없습니다.` });
    }
  }

  const mergeGroups: DatasetMergeGroup[] = [];
  const candidates: DatasetAssetCandidate[] = [];
  const glossaryGroups = groupByNormalized(glossaryRows, (row) => row.standardKo);
  for (const [key, group] of glossaryGroups) {
    const specialties = [...new Set(group.map((row) => row.specialty))];
    const englishTerms = unique(group.map((row) => row.officialEnglishTerm).filter(Boolean));
    const isShared = specialties.length > 1;
    if (isShared) {
      mergeGroups.push({ key: `term:${key}`, kind: "term", standardKo: group[0].standardKo, specialties, sourceIds: group.map((row) => row.id), suggestedScope: "global" });
      if (englishTerms.length > 1) {
        issues.push({ id: `term-english-conflict:${key}`, severity: "review", code: "term_translation_conflict", message: `${group[0].standardKo}의 공식 영문 표기가 데이터셋마다 다릅니다: ${englishTerms.join(" / ")}` });
      }
    }
    candidates.push({
      key: `term:${key}`,
      assetType: "term",
      scope: isShared ? "global" : "specialty",
      specialty: isShared ? null : group[0].specialty,
      sourceIds: group.map((row) => `${row.specialty}:${row.id}`),
      standardKo: group[0].standardKo,
      spokenForms: unique(group.flatMap((row) => row.spokenForms)),
      category: group[0].category,
      riskLevel: group.some((row) => row.riskLevel === "critical") ? "critical" : group.some((row) => row.riskLevel === "high") ? "high" : group[0].riskLevel,
      speechAct: "",
      direction: "",
      requiredTerms: [],
      forbiddenChanges: [],
      evidenceIds: unique(group.flatMap((row) => row.evidenceIds)),
      promotionReady: false,
      readinessReason: group.some((row) => row.reviewRequired)
        ? "용어 사람 검토와 17개 언어 번역 검수가 필요"
        : "17개 언어 용어 번역 검수 후 DB 승격 가능"
    });
  }

  const sourceGroups = groupByNormalized(sources, (row) => row.standardKo);
  for (const [key, group] of sourceGroups) {
    const specialties = [...new Set(group.map((row) => row.specialty))];
    const isShared = specialties.length > 1;
    if (isShared) {
      mergeGroups.push({ key: `sentence:${key}`, kind: "sentence", standardKo: group[0].standardKo, specialties, sourceIds: group.map((row) => row.id), suggestedScope: "global" });
    }
    const primary = group[0];
    candidates.push({
      key: `sentence:${key}`,
      assetType: sourceAssetType(primary),
      scope: isShared ? "global" : "specialty",
      specialty: isShared ? null : primary.specialty,
      sourceIds: group.map((row) => `${row.specialty}:${row.id}`),
      standardKo: primary.standardKo,
      spokenForms: unique(group.flatMap((row) => row.spokenForms)),
      category: primary.category,
      riskLevel: primary.riskLevel,
      speechAct: primary.speechAct,
      direction: primary.direction,
      requiredTerms: unique(group.flatMap((row) => row.requiredTerms)),
      forbiddenChanges: unique(group.flatMap((row) => row.forbiddenChanges)),
      evidenceIds: unique(group.flatMap((row) => row.evidenceIds)),
      promotionReady: false,
      readinessReason: group.every((row) => row.humanApproved)
        ? "17개 언어 번역 검수 후 DB 승격 가능"
        : "의료진 승인과 17개 언어 번역 검수가 필요"
    });
  }

  const aliasTargets = new Map<string, { alias: string; targets: Set<string> }>();
  for (const candidate of candidates.filter((candidate) => candidate.assetType === "term")) {
    for (const alias of candidate.spokenForms) {
      const aliasKey = normalizeDatasetText(alias);
      if (!aliasKey) continue;
      const entry = aliasTargets.get(aliasKey) ?? { alias, targets: new Set<string>() };
      entry.targets.add(candidate.standardKo);
      aliasTargets.set(aliasKey, entry);
    }
  }
  for (const [key, entry] of aliasTargets) {
    if (entry.targets.size > 1) {
      issues.push({ id: `alias-conflict:${key}`, severity: "review", code: "alias_conflict", message: `발음·별칭 '${entry.alias}'이 여러 표준용어에 연결됩니다: ${[...entry.targets].join(" / ")}` });
    }
  }

  const blockerCount = issues.filter((issue) => issue.severity === "blocker").length;
  const reviewCount = issues.filter((issue) => issue.severity === "review").length;
  return {
    summary: {
      fileCount: files.length,
      sourceSentenceCount: sources.length,
      glossaryTermCount: glossaryRows.length,
      numericTestCount: numericTests.length,
      highCriticalCount: sources.filter((source) => ["high", "critical"].includes(source.riskLevel)).length,
      sttMappingCount: candidates.filter((candidate) => candidate.assetType === "term").reduce((sum, candidate) => sum + candidate.spokenForms.length, 0),
      globalMergeGroupCount: mergeGroups.length,
      databaseReadyCount: 0,
      sourceReviewPendingCount: files.reduce((sum, file) => sum + file.sourceReviewPendingCount, 0),
      humanApprovalPendingCount: files.reduce((sum, file) => sum + file.humanApprovalPendingCount, 0),
      glossaryReviewPendingCount: files.reduce((sum, file) => sum + file.glossaryReviewPendingCount, 0),
      blockerCount,
      reviewCount
    },
    files,
    candidates: candidates.sort((left, right) => {
      const riskOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
      return (riskOrder[left.riskLevel] ?? 4) - (riskOrder[right.riskLevel] ?? 4) || left.standardKo.localeCompare(right.standardKo, "ko");
    }),
    numericTests,
    mergeGroups,
    issues
  };
}
