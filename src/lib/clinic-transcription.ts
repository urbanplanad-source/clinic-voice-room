export type ClinicTranscriptionHintSource = "code" | "term" | "transcription_hint";

export type ClinicTranscriptionHintMapping = {
  standardKo: string;
  spokenForms: string[];
  category?: string;
  priority?: number;
  source?: ClinicTranscriptionHintSource;
};

export type ClinicTranscriptionConflict = {
  spokenForm: string;
  standardForms: string[];
};

export type ClinicTranscriptionContext = {
  canonicalHints: string[];
  mappings: ClinicTranscriptionHintMapping[];
  conflicts: ClinicTranscriptionConflict[];
};

export type ClinicTranscriptionPromptDetails = {
  prompt: string;
  chars: number;
  hintCount: number;
  mappingCount: number;
  omittedHintCount: number;
  omittedMappingCount: number;
  omittedHints: string[];
  omittedMappingStandardForms: string[];
  truncated: boolean;
  conflicts: ClinicTranscriptionConflict[];
};

type TermLike = {
  standardKo: string;
  spoken: string[];
  category: string;
  priority?: number;
};

// Realtime client_secrets rejects audio.input.transcription.prompt above 1,024 characters.
export const defaultClinicTranscriptionPromptMaxChars = 1_024;

const sttTermCategories = new Set([
  "brand",
  "device",
  "medical",
  "medication",
  "procedure"
]);

const koreanOrAsciiHintPattern = /[가-힣]|^[A-Za-z0-9][A-Za-z0-9 .+()/_-]*$/;

function compact(value: string) {
  return value.normalize("NFKC").replace(/\s+/g, " ").trim();
}

export function normalizeTranscriptionKey(value: string) {
  return compact(value).toLocaleLowerCase("ko-KR").replace(/\s+/g, "");
}

export function findClinicTranscriptionAliasConflict(
  standardKo: string,
  spokenForms: string[],
  rows: Array<{ id: string; standardKo: string; spokenForms: string[] }>
) {
  const requestedForms = new Map<string, string>();
  for (const spokenForm of spokenForms) {
    const key = normalizeTranscriptionKey(spokenForm);
    if (key && !requestedForms.has(key)) requestedForms.set(key, compact(spokenForm));
  }
  const canonicalKey = normalizeTranscriptionKey(standardKo);

  for (const row of rows) {
    if (normalizeTranscriptionKey(row.standardKo) === canonicalKey) continue;
    for (const spokenForm of row.spokenForms) {
      const requestedForm = requestedForms.get(normalizeTranscriptionKey(spokenForm));
      if (requestedForm) {
        return { entryId: row.id, spokenForm: requestedForm, standardKo: row.standardKo };
      }
    }
  }
  return null;
}

function uniqueValues(values: string[]) {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const rawValue of values) {
    const value = compact(rawValue);
    const key = normalizeTranscriptionKey(value);
    if (!value || !key || seen.has(key)) continue;
    seen.add(key);
    result.push(value);
  }
  return result;
}

function isUsefulKoreanInputHint(value: string) {
  const compactValue = compact(value);
  return compactValue.length >= 2 && compactValue.length <= 120 && koreanOrAsciiHintPattern.test(compactValue);
}

export function transcriptionMappingsFromTerms(terms: TermLike[]): ClinicTranscriptionHintMapping[] {
  return terms
    .filter((term) => sttTermCategories.has(term.category))
    .map((term) => ({
      standardKo: compact(term.standardKo),
      spokenForms: uniqueValues(term.spoken).filter(isUsefulKoreanInputHint),
      category: term.category,
      priority: term.priority ?? 100,
      source: "term" as const
    }))
    .filter((mapping) => mapping.standardKo && mapping.spokenForms.length > 0);
}

function unambiguousTermAliasMap(mappings: ClinicTranscriptionHintMapping[]) {
  const targets = new Map<string, Set<string>>();
  const display = new Map<string, string>();

  for (const mapping of mappings.filter((item) => item.source === "term")) {
    for (const spokenForm of [...mapping.spokenForms, mapping.standardKo]) {
      const key = normalizeTranscriptionKey(spokenForm);
      if (!key) continue;
      targets.set(key, new Set([...(targets.get(key) ?? []), mapping.standardKo]));
      display.set(key, mapping.standardKo);
    }
  }

  const result = new Map<string, string>();
  for (const [key, standardForms] of targets) {
    if (standardForms.size === 1) result.set(key, display.get(key) ?? [...standardForms][0]);
  }
  return result;
}

export function prepareClinicTranscriptionContext(
  canonicalHints: string[],
  rawMappings: ClinicTranscriptionHintMapping[]
): ClinicTranscriptionContext {
  const mappings = rawMappings
    .map((mapping) => ({
      ...mapping,
      standardKo: compact(mapping.standardKo),
      spokenForms: uniqueValues(mapping.spokenForms).filter(isUsefulKoreanInputHint),
      priority: mapping.priority ?? 100,
      source: mapping.source ?? "transcription_hint" as const
    }))
    .filter((mapping) => Boolean(mapping.standardKo));
  const termAliasMap = unambiguousTermAliasMap(mappings);
  const canonicalizedMappings = mappings.map((mapping) => {
    if (mapping.source === "term") return mapping;
    const canonical = termAliasMap.get(normalizeTranscriptionKey(mapping.standardKo)) ?? mapping.standardKo;
    return {
      ...mapping,
      standardKo: canonical,
      spokenForms: uniqueValues([
        ...mapping.spokenForms,
        ...(normalizeTranscriptionKey(canonical) === normalizeTranscriptionKey(mapping.standardKo) ? [] : [mapping.standardKo])
      ])
    };
  });

  const grouped = new Map<string, ClinicTranscriptionHintMapping>();
  for (const mapping of canonicalizedMappings) {
    const key = normalizeTranscriptionKey(mapping.standardKo);
    const existing = grouped.get(key);
    if (!existing) {
      grouped.set(key, mapping);
      continue;
    }
    grouped.set(key, {
      standardKo: existing.standardKo,
      spokenForms: uniqueValues([...existing.spokenForms, ...mapping.spokenForms]),
      category: existing.category || mapping.category,
      priority: Math.min(existing.priority ?? 100, mapping.priority ?? 100),
      source: existing.source === "transcription_hint" || mapping.source === "transcription_hint"
        ? "transcription_hint"
        : existing.source
    });
  }

  const aliasTargets = new Map<string, { spokenForm: string; standardForms: Set<string> }>();
  for (const mapping of grouped.values()) {
    for (const spokenForm of mapping.spokenForms) {
      if (normalizeTranscriptionKey(spokenForm) === normalizeTranscriptionKey(mapping.standardKo)) continue;
      const key = normalizeTranscriptionKey(spokenForm);
      const current = aliasTargets.get(key) ?? { spokenForm, standardForms: new Set<string>() };
      current.standardForms.add(mapping.standardKo);
      aliasTargets.set(key, current);
    }
  }

  const conflicts = [...aliasTargets.values()]
    .filter((item) => item.standardForms.size > 1)
    .map((item) => ({
      spokenForm: item.spokenForm,
      standardForms: [...item.standardForms].sort((a, b) => a.localeCompare(b, "ko"))
    }))
    .sort((a, b) => a.spokenForm.localeCompare(b.spokenForm, "ko"));
  const conflictingKeys = new Set(conflicts.map((conflict) => normalizeTranscriptionKey(conflict.spokenForm)));

  const preparedMappings = [...grouped.values()]
    .map((mapping) => ({
      ...mapping,
      spokenForms: mapping.spokenForms.filter((spokenForm) => {
        const key = normalizeTranscriptionKey(spokenForm);
        return key !== normalizeTranscriptionKey(mapping.standardKo) && !conflictingKeys.has(key);
      })
    }))
    .filter((mapping) => mapping.spokenForms.length > 0)
    .sort((a, b) => {
      const priorityDiff = (a.priority ?? 100) - (b.priority ?? 100);
      if (priorityDiff !== 0) return priorityDiff;
      const sourceDiff = (a.source === "transcription_hint" ? 0 : 1) - (b.source === "transcription_hint" ? 0 : 1);
      if (sourceDiff !== 0) return sourceDiff;
      return a.standardKo.localeCompare(b.standardKo, "ko");
    });

  const preparedHints = uniqueValues([
    ...canonicalHints.flatMap((hint) => {
      const canonical = termAliasMap.get(normalizeTranscriptionKey(hint)) ?? hint;
      const preserveAsciiBrand = canonical !== hint && /^[A-Za-z0-9][A-Za-z0-9 .+()/_-]*$/.test(hint.trim());
      return preserveAsciiBrand ? [canonical, hint] : [canonical];
    }),
    ...preparedMappings.map((mapping) => mapping.standardKo)
  ]);

  return {
    canonicalHints: preparedHints,
    mappings: preparedMappings,
    conflicts
  };
}

export function buildKoreanClinicTranscriptionPrompt(
  canonicalHints: string[],
  mappings: ClinicTranscriptionHintMapping[],
  maxChars = defaultClinicTranscriptionPromptMaxChars
): ClinicTranscriptionPromptDetails {
  const context = prepareClinicTranscriptionContext(canonicalHints, mappings);
  const intro = [
    "Korean dermatology and plastic-surgery clinic.",
    "Speech may be short, fast, or masked.",
    "Transcribe only what was spoken and do not invent a procedure."
  ].join(" ");
  const footer = [
    "Preserve questions as questions.",
    "Preserve Arabic numbers and clinic units such as 샷, cc, 유닛, 바이알, 원, 회, 일, 주, and 개월.",
    "Distinguish Re2O (리투오 or 리투어) from 리쥬란; never substitute one brand for the other.",
    "Use a listed term only when acoustically plausible."
  ].join(" ");
  const safeMaxChars = Math.max(600, maxChars);
  const contentBudget = Math.max(200, safeMaxChars - intro.length - footer.length - 2);
  const canonicalOrder = new Map(context.canonicalHints.map((hint, index) => [normalizeTranscriptionKey(hint), index]));
  const orderedMappings = [...context.mappings].sort((a, b) => {
    const aOrder = canonicalOrder.get(normalizeTranscriptionKey(a.standardKo)) ?? Number.MAX_SAFE_INTEGER;
    const bOrder = canonicalOrder.get(normalizeTranscriptionKey(b.standardKo)) ?? Number.MAX_SAFE_INTEGER;
    if (aOrder !== bOrder) return aOrder - bOrder;
    return (a.priority ?? 100) - (b.priority ?? 100);
  });
  const renderMappings = (items: ClinicTranscriptionHintMapping[]) => items.length === 0
    ? ""
    : `Correct likely acoustic near-matches: ${items.map((mapping) => {
        const spokenForms = mapping.spokenForms.slice(0, 3).join(" / ");
        return `${spokenForms} -> ${mapping.standardKo};`;
      }).join(" ")}`;
  const renderHints = (items: string[]) => items.length === 0
    ? ""
    : `Likely terms and phrases: ${items.map((hint) => `${hint};`).join(" ")}`;
  const withoutMappedHints = (items: ClinicTranscriptionHintMapping[]) => {
    const mappedCanonicalKeys = new Set(items.map((mapping) => normalizeTranscriptionKey(mapping.standardKo)));
    return context.canonicalHints.filter((hint) => !mappedCanonicalKeys.has(normalizeTranscriptionKey(hint)));
  };

  let selectedMappings: ClinicTranscriptionHintMapping[] = [];
  let remainingHints = [...context.canonicalHints];
  let mappingContent = "";
  let hintContent = renderHints(remainingHints);
  let mappingCount = 0;
  let hintCount = 0;
  let omittedHintCount = 0;

  if (hintContent.length <= contentBudget) {
    for (const mapping of orderedMappings) {
      const candidateMappings = [...selectedMappings, mapping];
      const candidateHints = withoutMappedHints(candidateMappings);
      const candidateMappingContent = renderMappings(candidateMappings);
      const candidateHintContent = renderHints(candidateHints);
      const candidateContent = [candidateMappingContent, candidateHintContent].filter(Boolean).join(" ");
      if (candidateContent.length > contentBudget) break;
      selectedMappings = candidateMappings;
      remainingHints = candidateHints;
      mappingContent = candidateMappingContent;
      hintContent = candidateHintContent;
    }
    mappingCount = selectedMappings.length;
    hintCount = remainingHints.length;
  } else {
    const mappingBudget = Math.floor(contentBudget * 0.56);
    for (const mapping of orderedMappings) {
      const candidateMappings = [...selectedMappings, mapping];
      const candidateMappingContent = renderMappings(candidateMappings);
      if (candidateMappingContent.length > mappingBudget) break;
      selectedMappings = candidateMappings;
      mappingContent = candidateMappingContent;
    }
    mappingCount = selectedMappings.length;
    remainingHints = withoutMappedHints(selectedMappings);
    const hintBudget = contentBudget - mappingContent.length - (mappingContent ? 1 : 0);
    const includedHints: string[] = [];
    for (const hint of remainingHints) {
      const candidateHintContent = renderHints([...includedHints, hint]);
      if (candidateHintContent.length > hintBudget) break;
      includedHints.push(hint);
      hintContent = candidateHintContent;
    }
    hintCount = includedHints.length;
    omittedHintCount = remainingHints.length - hintCount;
  }

  const content = [mappingContent, hintContent].filter(Boolean).join(" ");
  const prompt = [intro, content, footer].filter(Boolean).join(" ");
  const selectedMappingKeys = new Set(selectedMappings.map((mapping) => normalizeTranscriptionKey(mapping.standardKo)));
  const omittedMappingStandardForms = orderedMappings
    .filter((mapping) => !selectedMappingKeys.has(normalizeTranscriptionKey(mapping.standardKo)))
    .map((mapping) => mapping.standardKo);
  const omittedHints = remainingHints.slice(hintCount);
  const omittedMappingCount = omittedMappingStandardForms.length;
  return {
    prompt,
    chars: prompt.length,
    hintCount,
    mappingCount,
    omittedHintCount,
    omittedMappingCount,
    omittedHints,
    omittedMappingStandardForms,
    truncated: omittedHintCount > 0 || omittedMappingCount > 0,
    conflicts: context.conflicts
  };
}

function escapedFlexiblePattern(value: string) {
  return compact(value)
    .split(/\s+/)
    .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("\\s*");
}

export function normalizeClinicSourceTranscript(
  text: string,
  canonicalHints: string[],
  mappings: ClinicTranscriptionHintMapping[]
) {
  const context = prepareClinicTranscriptionContext(canonicalHints, mappings);
  const replacements = context.mappings
    .flatMap((mapping) => mapping.spokenForms.map((spokenForm) => ({ spokenForm, standardKo: mapping.standardKo })))
    .filter(({ spokenForm, standardKo }) => {
      const spokenKey = normalizeTranscriptionKey(spokenForm);
      return spokenKey.length >= 3 && spokenKey !== normalizeTranscriptionKey(standardKo);
    })
    .sort((a, b) => normalizeTranscriptionKey(b.spokenForm).length - normalizeTranscriptionKey(a.spokenForm).length);

  let normalized = text.trim();
  for (const replacement of replacements) {
    const asciiOnly = /^[\x00-\x7F]+$/.test(replacement.spokenForm);
    const source = escapedFlexiblePattern(replacement.spokenForm);
    const pattern = asciiOnly
      ? new RegExp(`(?<![A-Za-z0-9])${source}(?![A-Za-z0-9])`, "gi")
      : new RegExp(source, "g");
    normalized = normalized.replace(pattern, replacement.standardKo);
  }
  return normalized.replace(/\s{2,}/g, " ").trim();
}

export function changedTranscriptionSpan(observedText: string, correctedText: string) {
  const observed = compact(observedText).split(" ").filter(Boolean);
  const corrected = compact(correctedText).split(" ").filter(Boolean);
  let prefix = 0;
  while (prefix < observed.length && prefix < corrected.length && observed[prefix] === corrected[prefix]) prefix += 1;

  let observedSuffix = observed.length - 1;
  let correctedSuffix = corrected.length - 1;
  while (
    observedSuffix >= prefix &&
    correctedSuffix >= prefix &&
    observed[observedSuffix] === corrected[correctedSuffix]
  ) {
    observedSuffix -= 1;
    correctedSuffix -= 1;
  }

  return {
    observedForm: observed.slice(prefix, observedSuffix + 1).join(" "),
    canonicalForm: corrected.slice(prefix, correctedSuffix + 1).join(" ")
  };
}
