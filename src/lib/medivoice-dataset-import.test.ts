import { describe, expect, it } from "vitest";
import {
  analyzeMedivoiceDatasets,
  type DatasetWorkbookInput,
  type MedivoiceDatasetSpecialty
} from "./medivoice-dataset-import";

const sourceHeaders = [
  "sentence_id", "specialty", "scenario", "subcategory", "speaker", "direction", "speech_act",
  "standard_ko", "spoken_variants_ko", "context_note_ko", "primary_risk_type", "risk_flags",
  "risk_level", "required_terms", "forbidden_changes", "source_qa_status", "source_qa_reason_ko",
  "evidence_id", "human_approved", "release_status"
];

const glossaryHeaders = [
  "glossary_id", "standard_ko", "patient_friendly_ko", "spoken_aliases_ko", "definition_ko",
  "usage_context", "terms_to_avoid", "official_english_term", "abbreviation", "risk_level",
  "evidence_id", "review_required", "notes"
];

function workbook(
  specialty: MedivoiceDatasetSpecialty,
  label: string,
  sourceId: string,
  glossaryId: string,
  options: { term?: string; alias?: string; english?: string; omitGlossary?: boolean } = {}
): DatasetWorkbookInput {
  const sheets: DatasetWorkbookInput["sheets"] = [
    {
      sheet: "source_master",
      data: [
        sourceHeaders,
        [sourceId, label, "응급 대응", "호흡", "clinician", "clinician_to_patient", "warning", `${label} 응급 문장`, "", "", "emergency", "", "critical", "즉시;응급실", "기다리라고 바꾸지 말 것", "review", "의료진 확인 필요", "E01", false, "human_review_required"]
      ]
    },
    {
      sheet: "numeric_test_candidates",
      data: [["candidate_id", "scenario", "standard_ko_slot", "required_terms", "forbidden_changes"], [`N-${sourceId}`, "용량", "{용량} mL", "용량;mL", "숫자 변경 금지"]]
    }
  ];
  if (!options.omitGlossary) {
    sheets.push({
      sheet: "glossary",
      data: [
        glossaryHeaders,
        [glossaryId, options.term ?? "부종", "", options.alias ?? "붓기", "", "증상", "", options.english ?? "edema", "", "high", "E01", true, ""]
      ]
    });
  }
  return { fileName: `${label}.xlsx`, expectedSpecialty: specialty, sheets };
}

describe("analyzeMedivoiceDatasets", () => {
  it("merges exact cross-specialty terms into one global dry-run candidate", () => {
    const result = analyzeMedivoiceDatasets([
      workbook("dermatology", "피부과", "D001", "DG001"),
      workbook("plastic_surgery", "성형외과", "P001", "PG001"),
      workbook("oriental_medicine", "한의원", "K001", "KG001", { term: "항응고제", alias: "피 묽게 하는 약", english: "anticoagulant" })
    ]);

    const edema = result.candidates.find((candidate) => candidate.standardKo === "부종");
    expect(edema).toMatchObject({ assetType: "term", scope: "global", specialty: null, promotionReady: false });
    expect(edema?.sourceIds).toHaveLength(2);
    expect(result.summary.sourceSentenceCount).toBe(3);
    expect(result.summary.numericTestCount).toBe(3);
    expect(result.summary.databaseReadyCount).toBe(0);
    expect(result.summary.sourceReviewPendingCount).toBe(3);
    expect(result.summary.humanApprovalPendingCount).toBe(3);
    expect(result.summary.glossaryReviewPendingCount).toBe(3);
    expect(result.summary.blockerCount).toBe(0);
  });

  it("flags an alias that points to different standard terms", () => {
    const result = analyzeMedivoiceDatasets([
      workbook("dermatology", "피부과", "D001", "DG001", { term: "부종", alias: "붓기" }),
      workbook("plastic_surgery", "성형외과", "P001", "PG001", { term: "종창", alias: "붓기", english: "swelling" }),
      workbook("oriental_medicine", "한의원", "K001", "KG001", { term: "항응고제", alias: "피 묽게 하는 약", english: "anticoagulant" })
    ]);

    expect(result.issues).toContainEqual(expect.objectContaining({ code: "alias_conflict", severity: "review" }));
  });

  it("blocks a workbook missing a required sheet", () => {
    const result = analyzeMedivoiceDatasets([
      workbook("dermatology", "피부과", "D001", "DG001", { omitGlossary: true }),
      workbook("plastic_surgery", "성형외과", "P001", "PG001"),
      workbook("oriental_medicine", "한의원", "K001", "KG001")
    ]);

    expect(result.issues).toContainEqual(expect.objectContaining({ code: "missing_sheet", severity: "blocker", specialty: "dermatology" }));
    expect(result.summary.blockerCount).toBeGreaterThan(0);
  });
});
