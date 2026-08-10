export type NumberCheckGuard = {
  numberCheck: "mismatch";
  sourceNumbers: number[];
  translatedNumbers: number[];
};

export type BackTranslationGuard = {
  status: "pending" | "pass" | "fail" | "skipped";
  categories?: string[];
  backText?: string;
  reason?: string;
};

export type PatientConfirmationGuard = {
  required: true;
  categories: string[];
  status: "pending" | "confirmed" | "repeat_requested";
  respondedAt?: string;
};

export type TranslationQualityGuard = {
  initialDeterministicStatus: "pass" | "fail";
  finalDeterministicStatus: "pass" | "fail";
  semanticStatus: "pass" | "fail" | "not_required" | "unavailable";
  validationPath: "standard" | "repair" | "strict";
  corrected: boolean;
  riskLevel: "normal" | "high";
  riskReasons: string[];
  failureReasons?: string[];
  validationMs?: number;
  correctionMs?: number;
};

export type GuardFlags = Partial<NumberCheckGuard> & {
  backTranslation?: BackTranslationGuard;
  confirmation?: PatientConfirmationGuard;
  quality?: TranslationQualityGuard;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function numberArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is number => typeof item === "number" && Number.isFinite(item)) : undefined;
}

export function parseGuardFlags(value: unknown): GuardFlags | undefined {
  if (!isRecord(value)) return undefined;

  const flags: GuardFlags = {};
  if (value.numberCheck === "mismatch") {
    flags.numberCheck = "mismatch";
    flags.sourceNumbers = numberArray(value.sourceNumbers) ?? [];
    flags.translatedNumbers = numberArray(value.translatedNumbers) ?? [];
  }

  if (isRecord(value.backTranslation)) {
    const status = value.backTranslation.status;
    if (status === "pending" || status === "pass" || status === "fail" || status === "skipped") {
      flags.backTranslation = {
        status,
        categories: Array.isArray(value.backTranslation.categories)
          ? value.backTranslation.categories.filter((item): item is string => typeof item === "string")
          : undefined,
        backText: typeof value.backTranslation.backText === "string" ? value.backTranslation.backText : undefined,
        reason: typeof value.backTranslation.reason === "string" ? value.backTranslation.reason : undefined
      };
    }
  }

  if (isRecord(value.confirmation) && value.confirmation.required === true) {
    const status = value.confirmation.status;
    if (status === "pending" || status === "confirmed" || status === "repeat_requested") {
      flags.confirmation = {
        required: true,
        categories: Array.isArray(value.confirmation.categories)
          ? value.confirmation.categories.filter((item): item is string => typeof item === "string")
          : [],
        status,
        respondedAt: typeof value.confirmation.respondedAt === "string" ? value.confirmation.respondedAt : undefined
      };
    }
  }

  if (isRecord(value.quality)) {
    const initial = value.quality.initialDeterministicStatus;
    const final = value.quality.finalDeterministicStatus;
    const semantic = value.quality.semanticStatus;
    const validationPath = value.quality.validationPath;
    const riskLevel = value.quality.riskLevel;
    if (
      (initial === "pass" || initial === "fail") &&
      (final === "pass" || final === "fail") &&
      (semantic === "pass" || semantic === "fail" || semantic === "not_required" || semantic === "unavailable") &&
      (validationPath === "standard" || validationPath === "repair" || validationPath === "strict") &&
      (riskLevel === "normal" || riskLevel === "high")
    ) {
      flags.quality = {
        initialDeterministicStatus: initial,
        finalDeterministicStatus: final,
        semanticStatus: semantic,
        validationPath,
        corrected: value.quality.corrected === true,
        riskLevel,
        riskReasons: Array.isArray(value.quality.riskReasons)
          ? value.quality.riskReasons.filter((item): item is string => typeof item === "string")
          : [],
        failureReasons: Array.isArray(value.quality.failureReasons)
          ? value.quality.failureReasons.filter((item): item is string => typeof item === "string")
          : undefined,
        validationMs: typeof value.quality.validationMs === "number" ? value.quality.validationMs : undefined,
        correctionMs: typeof value.quality.correctionMs === "number" ? value.quality.correctionMs : undefined
      };
    }
  }

  return Object.keys(flags).length > 0 ? flags : undefined;
}

export function mergeGuardFlags(existing: unknown, patch: GuardFlags | undefined): GuardFlags | undefined {
  const current = parseGuardFlags(existing) ?? {};
  if (!patch || Object.keys(patch).length === 0) return Object.keys(current).length > 0 ? current : undefined;

  return {
    ...current,
    ...patch,
    backTranslation: patch.backTranslation ?? current.backTranslation,
    confirmation: patch.confirmation ?? current.confirmation,
    quality: patch.quality ?? current.quality
  };
}
