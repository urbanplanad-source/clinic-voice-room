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

export type GuardFlags = Partial<NumberCheckGuard> & {
  backTranslation?: BackTranslationGuard;
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

  return Object.keys(flags).length > 0 ? flags : undefined;
}

export function mergeGuardFlags(existing: unknown, patch: GuardFlags | undefined): GuardFlags | undefined {
  const current = parseGuardFlags(existing) ?? {};
  if (!patch || Object.keys(patch).length === 0) return Object.keys(current).length > 0 ? current : undefined;

  return {
    ...current,
    ...patch,
    backTranslation: patch.backTranslation ?? current.backTranslation
  };
}
