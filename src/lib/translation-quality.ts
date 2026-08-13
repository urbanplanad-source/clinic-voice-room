import { compareClinicalUnitSignatures } from "./clinical-unit-guard";
import { compareNumericSignatures } from "./number-guard";
import { containsUnexpectedHangul, isClearlyNotKoreanTranslation } from "./translation-language-guard";

export type DeterministicStatus = "pass" | "fail";
export type SemanticStatus = "pass" | "fail" | "not_required" | "unavailable";
export type TranslationRiskLevel = "normal" | "high";
export type TranslationValidationPath = "standard" | "repair" | "strict";

export type TranslationLatency = {
  clientTranscriptMs?: number;
  requestRoundTripMs?: number;
  serverGlossaryMs?: number;
  serverTranslationMs?: number;
  serverValidationMs?: number;
  serverCorrectionMs?: number;
  resultReadyMs?: number;
  ttsStartedMs?: number;
  totalMs?: number;
};

export type TranslationResult = {
  turnId: string;
  status: "final" | "blocked" | "retry_required";
  finalTranslation?: string;
  translationSource: "verified_sentence" | "model";
  enginePath: "realtime" | "upload_fallback" | "strict";
  modelId?: string;
  glossaryVersion: string;
  packVersion: string;
  normalizationVersion: number;
  matchedEntryIds: string[];
  riskLevel: TranslationRiskLevel;
  riskReasons: string[];
  initialDeterministicStatus: DeterministicStatus;
  finalDeterministicStatus: DeterministicStatus;
  semanticStatus: SemanticStatus;
  corrected: boolean;
  validationPath: TranslationValidationPath;
  latency: TranslationLatency;
};

export type DeterministicTranslationCheck = {
  status: DeterministicStatus;
  failureReasons: string[];
  riskLevel: TranslationRiskLevel;
  riskReasons: string[];
  numberPreserved: boolean;
  clinicalUnitPreserved: boolean;
  targetLanguagePreserved: boolean;
  questionPreserved: boolean;
  negationPreserved: boolean;
  stopOrRefusalPreserved: boolean;
  brandPreserved: boolean;
};

const semanticallyOverridableFailureReasons = new Set([
  "question_form_mismatch",
  "negation_mismatch"
]);

export function resolveSemanticallyConfirmedDeterministic(
  check: DeterministicTranslationCheck
): DeterministicTranslationCheck {
  if (
    check.status === "pass" ||
    check.failureReasons.some((reason) => !semanticallyOverridableFailureReasons.has(reason))
  ) {
    return check;
  }
  return {
    ...check,
    status: "pass",
    failureReasons: []
  };
}

const amountPattern = /(?:₩|\b(?:KRW|USD|JPY|CNY|RMB)\b|원|만원|천원|달러|엔|위안|유로|가격|금액|비용|결제|料金|価格|費用|价格|價格|费用|費用|price|cost|fee|payment)/iu;
const adverseEffectPattern = /(?:부작용|이상\s*반응|副作用|不良反[应應]|異常な?\s*反応|异常反应|異常反應|side\s*effects?|adverse\s*(?:effect|reaction)s?)/iu;
const medicalInstructionPattern = /(?:복용|투여|바르|주사|시술|수술|치료|약|먹|드시|금지|피해|止め|服用|注射|施術|治疗|治療|服药|服藥|take\s+(?:the\s+)?medicine|apply|inject|procedure|treatment|do\s+not)/iu;
const doseRoutePattern = /(?:mg|mcg|ml|mL|cc|IU|정|캡슐|포|방울|하루|매일|복용|투여|도포|주사|口服|服用|注射|塗布|take|apply|inject)/iu;
const consentPattern = /(?:동의|거부|중단|취소|원하지|同意|拒否|中止|拒绝|拒絕|consent|refus|stop|cancel)/iu;
const procedureExecutionPattern = /(?:지금|시작|진행|시술|수술|치료|施術|手術|开始|開始|进行|進行|procedure|surgery|treatment|begin|start)/iu;
const conditionPattern = /(?:임신|알레르기|금기|孕|妊娠|アレルギー|禁忌|过敏|過敏|pregnan|allerg|contraindicat)/iu;
const decisionPattern = /(?:가능|불가능|해야|하지\s*마|권장|결정|동의|중단|でき|不可|建议|建議|should|must|cannot|recommend|decid)/iu;

const questionPatterns = [
  /[?？؟]/u,
  /(?:나요|까요|습니까|세요\?|인지요|어떻게|언제|어디|왜|무엇|누가|몇\s)/u,
  /(?:吗|嗎|呢|是否|怎么|怎麼|为什么|為什麼|多少|哪[里裡]?|咩|有冇|係咪)/u,
  /(?:ですか|ますか|でしょうか|なぜ|どう|いつ|どこ|何|誰)/u,
  /(?:^|[.!?。！？؟]\s*)(?:who|what|when|where|why|how|which|can|could|would|will|is|are|do(?!\s+not\b)|does(?!\s+not\b)|did(?!\s+not\b)|have|has)\b/iu
];

const negationPatterns = [
  /(?:아닌|아니(?!면)|않|못\s|없|마세요|말아|금지|피하)/u,
  /(?:^|[\s"'“‘(])안(?:\s|$)/u,
  /(?:不|没|沒|无|無|别|別|禁止|避免|冇|唔)/u,
  /(?:ない|ません|禁止|やめ|避け)/u,
  /\b(?:no|not|never|none|without|cannot|can't|don't|doesn't|mustn't|avoid)\b/iu,
  /\b(?:ne|pas|non|kein|nicht|no|sin|sem|não|nao|nie|bez|không|khong|chưa|chua|tidak|bukan|jangan)\b/iu,
  /(?:не|нет|без|ไม่)/iu
];

const stopOrRefusalPatterns = [
  /(?:중단|멈추|멈춰|그만|거부|취소)/u,
  /(?:中止|停止|止め|止ま|拒否|取消)/u,
  /(?:停止|中止|停(?:針|针)?|拒绝|拒絕|取消)/u,
  /\b(?:stop|halt|discontinue|refus(?:e|al|ed|ing)?|cancel(?:led|ing)?|hentikan|berhenti|dừng|dung|arrêt(?:ez|er)?|arretez|pare|parar|interromp(?:a|er)|หยุด)\b/iu,
  /(?:останов|прекрат)/iu
];

const brandAliases: Array<{ canonical: string; pattern: RegExp }> = [
  { canonical: "re2o", pattern: /(?:\bRe2O\b|리투오)/iu },
  { canonical: "rejuran-hb", pattern: /(?:\bRejuran\s+HB\b|리쥬란\s*HB|丽珠兰\s*HB|麗珠蘭\s*HB|リジュラン\s*HB)/iu },
  { canonical: "rejuran", pattern: /(?:\bRejuran\b|리쥬란|丽珠兰|麗珠蘭|リジュラン)/iu },
  { canonical: "xerf", pattern: /(?:\bXERF\b|세르프)/iu },
  { canonical: "thermage-flx", pattern: /(?:\bThermage\s+FLX\b|써마지\s*FLX|热玛吉\s*FLX|熱瑪吉\s*FLX|サーマクール\s*FLX)/iu },
  { canonical: "thermage", pattern: /(?:\bThermage\b|써마지|热玛吉|熱瑪吉|サーマクール)/iu },
  { canonical: "ultherapy-prime", pattern: /(?:\bUltherapy\s+Prime\b|울쎄라(?:피)?\s*프라임)/iu },
  { canonical: "ultherapy", pattern: /(?:\bUltherapy\b|울쎄라(?:피)?)/iu },
  { canonical: "juvelook", pattern: /(?:\bJuvelook\b|쥬베룩|乔雅露|喬雅露|ジュベルック)/iu },
  { canonical: "restylane", pattern: /(?:\bRestylane\b|레스틸렌)/iu },
  { canonical: "belotero", pattern: /(?:\bBelotero\b|벨로테로)/iu },
  { canonical: "sculptra", pattern: /(?:\bSculptra\b|스컬트라)/iu },
  { canonical: "skinvive", pattern: /(?:\bSkinvive\b|스킨바이브)/iu },
  { canonical: "botox", pattern: /(?:\bBotox\b|보톡스|보툴리눔\s*톡신|botulinum\s+toxin|肉毒(?:杆菌|桿菌|素)|ボトックス|ボツリヌストキシン)/iu },
  { canonical: "potenza", pattern: /(?:\bPotenza\b|포텐자)/iu },
  { canonical: "pico", pattern: /(?:\bPico\b|피코)/iu },
  { canonical: "prp", pattern: /\bPRP\b/iu },
  { canonical: "ldm", pattern: /\bLDM\b/iu },
  { canonical: "hda", pattern: /\bHDA\b/iu }
];

function includesPattern(text: string, patterns: RegExp[]) {
  return patterns.some((pattern) => pattern.test(text));
}

function includesNegation(text: string) {
  const withoutAffirmativeChineseIdioms = text.replace(/(?:没错|沒錯|没有问题|沒有問題|无误|無誤)/gu, "");
  return includesPattern(withoutAffirmativeChineseIdioms, negationPatterns);
}

function normalizedBrandSet(text: string) {
  const matches = new Set<string>();
  for (const alias of brandAliases) if (alias.pattern.test(text)) matches.add(alias.canonical);
  return matches;
}

function sameSet(left: Set<string>, right: Set<string>) {
  if (left.size !== right.size) return false;
  for (const value of left) if (!right.has(value)) return false;
  return true;
}

export function classifyTranslationRisk(sourceText: string, translatedText = "") {
  const combined = `${sourceText}\n${translatedText}`.normalize("NFKC");
  const reasons: string[] = [];
  if (amountPattern.test(combined)) reasons.push("amount");
  if (adverseEffectPattern.test(combined)) reasons.push("adverse_effect");
  if (medicalInstructionPattern.test(translatedText) && !medicalInstructionPattern.test(sourceText)) reasons.push("possible_added_medical_instruction");
  if (doseRoutePattern.test(combined) && /\d|[一二三四五六七八九十百千]|(?:한|두|세|네)\s*(?:번|회|정)/u.test(combined)) reasons.push("medication_dose_or_route");
  if (consentPattern.test(combined) && procedureExecutionPattern.test(combined)) reasons.push("consent_or_refusal_in_execution_context");
  if (conditionPattern.test(combined) && decisionPattern.test(combined)) reasons.push("condition_in_decision_context");
  return { riskLevel: reasons.length > 0 ? "high" as const : "normal" as const, riskReasons: reasons };
}

export function analyzeDeterministicTranslation(params: {
  sourceText: string;
  translatedText: string;
  direction: "ko_to_patient" | "patient_to_ko";
  targetLanguage?: string;
}) : DeterministicTranslationCheck {
  const sourceText = params.sourceText.normalize("NFKC").trim();
  const translatedText = params.translatedText.normalize("NFKC").trim();
  const failureReasons: string[] = [];
  const numberPreserved = compareNumericSignatures(sourceText, translatedText).ok;
  const clinicalUnitPreserved = compareClinicalUnitSignatures(sourceText, translatedText).ok;
  const targetLanguagePreserved = params.direction === "patient_to_ko"
    ? !isClearlyNotKoreanTranslation(sourceText, translatedText)
    : !params.targetLanguage || params.targetLanguage === "ko" || !containsUnexpectedHangul(translatedText);
  const sourceQuestion = includesPattern(sourceText, questionPatterns);
  const translatedQuestion = includesPattern(translatedText, questionPatterns);
  const questionPreserved = sourceQuestion === translatedQuestion;
  const sourceNegation = includesNegation(sourceText);
  const translatedNegation = includesNegation(translatedText);
  const negationPreserved = sourceNegation === translatedNegation;
  const sourceStopOrRefusal = includesPattern(sourceText, stopOrRefusalPatterns);
  const translatedStopOrRefusal = includesPattern(translatedText, stopOrRefusalPatterns);
  const stopOrRefusalPreserved = sourceStopOrRefusal === translatedStopOrRefusal;
  const brandPreserved = sameSet(normalizedBrandSet(sourceText), normalizedBrandSet(translatedText));

  if (!numberPreserved) failureReasons.push("number_mismatch");
  if (!clinicalUnitPreserved) failureReasons.push("clinical_unit_mismatch");
  if (!targetLanguagePreserved) failureReasons.push("target_language_mismatch");
  if (!questionPreserved) failureReasons.push("question_form_mismatch");
  if (!negationPreserved) failureReasons.push("negation_mismatch");
  if (!stopOrRefusalPreserved) failureReasons.push("stop_or_refusal_mismatch");
  if (!brandPreserved) failureReasons.push("brand_mismatch");

  const risk = classifyTranslationRisk(sourceText, translatedText);
  if (failureReasons.includes("negation_mismatch")) risk.riskReasons.push("meaning_or_negation_reversal");
  if (failureReasons.includes("target_language_mismatch")) risk.riskReasons.push("translation_direction");

  return {
    status: failureReasons.length === 0 ? "pass" : "fail",
    failureReasons,
    riskLevel: risk.riskReasons.length > 0 ? "high" : risk.riskLevel,
    riskReasons: Array.from(new Set(risk.riskReasons)),
    numberPreserved,
    clinicalUnitPreserved,
    targetLanguagePreserved,
    questionPreserved,
    negationPreserved,
    stopOrRefusalPreserved,
    brandPreserved
  };
}
