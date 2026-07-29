export type ClinicalUnitComparison = {
  ok: boolean;
  missing: string[];
  extra: string[];
  sourceUnits: string[];
  translatedUnits: string[];
  pairMismatch: boolean;
  sourcePairs: string[];
  translatedPairs: string[];
};

type ClinicalUnitDefinition = {
  canonical: string;
  pattern: RegExp;
};

type ClinicalUnitOccurrence = {
  canonical: string;
  index: number;
  numericValue: string | null;
};

const clinicalUnitDefinitions: ClinicalUnitDefinition[] = [
  {
    canonical: "volume_ml",
    pattern: /(?<![A-Za-z])(?:cc|ml)(?![A-Za-z])|\bmillilit(?:er|re)s?\b|\u6BEB\u5347|\u30DF\u30EA\u30EA\u30C3\u30C8\u30EB|\uBC00\uB9AC\uB9AC\uD130/giu
  },
  {
    canonical: "mass_mg",
    pattern: /(?<![A-Za-z])mg(?![A-Za-z])|\bmilligrams?\b|\u6BEB\u514B|\u30DF\u30EA\u30B0\u30E9\u30E0|\uBC00\uB9AC\uADF8\uB7A8/giu
  },
  {
    canonical: "mass_kg",
    pattern: /(?<![A-Za-z])kg(?![A-Za-z])|\bkilograms?\b|\u516C\u65A4|\u5343\u514B|\u30AD\u30ED\u30B0\u30E9\u30E0|\uD0AC\uB85C\uADF8\uB7A8/giu
  },
  {
    canonical: "mass_g",
    pattern: /(?<![A-Za-z])g(?![A-Za-z])|\bgrams?\b|(?<![\u6BEB\u5343])\u514B|(?<!\u30DF\u30EA)(?<!\u30AD\u30ED)\u30B0\u30E9\u30E0|(?<!\uBC00\uB9AC)(?<!\uD0AC\uB85C)\uADF8\uB7A8/giu
  },
  {
    canonical: "length_mm",
    pattern: /(?<![A-Za-z])mm(?![A-Za-z])|\bmillimet(?:er|re)s?\b|\u6BEB\u7C73|\u30DF\u30EA\u30E1\u30FC\u30C8\u30EB|\uBC00\uB9AC\uBBF8\uD130/giu
  },
  {
    canonical: "length_cm",
    pattern: /(?<![A-Za-z])cm(?![A-Za-z])|\bcentimet(?:er|re)s?\b|\u5398\u7C73|\u516C\u5206|\u30BB\u30F3\u30C1\u30E1\u30FC\u30C8\u30EB|\uC13C\uD2F0\uBBF8\uD130/giu
  },
  {
    canonical: "percent",
    pattern: /%|\bpercent\b|\uD37C\uC13C\uD2B8|\u30D1\u30FC\u30BB\u30F3\u30C8|\u767E\u5206/giu
  },
  {
    canonical: "shot",
    pattern: /(?<![A-Za-z])shots?(?![A-Za-z])|\uC0F7|\u30B7\u30E7\u30C3\u30C8|\p{Nd}+\s*[\u53D1\u767C]/giu
  },
  {
    canonical: "ampoule",
    pattern: /(?<![A-Za-z])ampoules?(?![A-Za-z])|\uC568\uD50C|\uC5E0\uD50C|\u30A2\u30F3\u30D7\u30EB|\u5B89\u74F6/giu
  },
  {
    canonical: "iu",
    pattern: /(?<![A-Za-z])iu(?![A-Za-z])|\binternational\s+units?\b/giu
  }
];

const arabicNumberPattern = /[-+]?\d+(?:,\d{3})*(?:\.\d+)?/u;
const precedingArabicNumberPattern = /([-+]?\d+(?:,\d{3})*(?:\.\d+)?)\s*$/u;

function canonicalNumber(raw: string | undefined) {
  if (!raw) return null;
  const value = Number(raw.replace(/,/g, ""));
  return Number.isFinite(value) ? String(Number(value.toFixed(4))) : null;
}

function pairedNumber(normalized: string, matchedText: string, index: number) {
  const insideMatch = matchedText.match(arabicNumberPattern)?.[0];
  if (insideMatch) return canonicalNumber(insideMatch);

  const prefix = normalized.slice(Math.max(0, index - 24), index);
  return canonicalNumber(prefix.match(precedingArabicNumberPattern)?.[1]);
}

function extractClinicalUnitOccurrences(text: string) {
  const normalized = text.normalize("NFKC");
  const occurrences: ClinicalUnitOccurrence[] = [];

  for (const definition of clinicalUnitDefinitions) {
    for (const match of normalized.matchAll(definition.pattern)) {
      const index = match.index ?? 0;
      occurrences.push({
        canonical: definition.canonical,
        index,
        numericValue: pairedNumber(normalized, match[0], index)
      });
    }
  }

  return occurrences.sort((left, right) => left.index - right.index);
}

function countValues(values: string[]) {
  const counts = new Map<string, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return counts;
}

function diffValues(left: Map<string, number>, right: Map<string, number>) {
  const diff: string[] = [];
  for (const [value, count] of left) {
    const otherCount = right.get(value) ?? 0;
    for (let index = 0; index < count - otherCount; index += 1) diff.push(value);
  }
  return diff;
}

function pairedSignatures(occurrences: ClinicalUnitOccurrence[]) {
  return occurrences.flatMap((occurrence) =>
    occurrence.numericValue === null
      ? []
      : [`${occurrence.numericValue}:${occurrence.canonical}`]
  );
}

export function extractClinicalUnitSignature(text: string) {
  return extractClinicalUnitOccurrences(text).map((occurrence) => occurrence.canonical);
}

export function compareClinicalUnitSignatures(
  source: string,
  translated: string
): ClinicalUnitComparison {
  const sourceOccurrences = extractClinicalUnitOccurrences(source);
  const translatedOccurrences = extractClinicalUnitOccurrences(translated);
  const sourceUnits = sourceOccurrences.map((occurrence) => occurrence.canonical);
  const translatedUnits = translatedOccurrences.map((occurrence) => occurrence.canonical);
  const sourceCounts = countValues(sourceUnits);
  const translatedCounts = countValues(translatedUnits);
  const missing = diffValues(sourceCounts, translatedCounts);
  const extra = diffValues(translatedCounts, sourceCounts);

  const sourcePairs = pairedSignatures(sourceOccurrences);
  const translatedPairs = pairedSignatures(translatedOccurrences);
  const pairsComparable =
    sourcePairs.length > 0 && sourcePairs.length === translatedPairs.length;
  const pairMismatch = pairsComparable && (
    diffValues(countValues(sourcePairs), countValues(translatedPairs)).length > 0 ||
    diffValues(countValues(translatedPairs), countValues(sourcePairs)).length > 0
  );

  return {
    ok: missing.length === 0 && extra.length === 0 && !pairMismatch,
    missing,
    extra,
    sourceUnits,
    translatedUnits,
    pairMismatch,
    sourcePairs,
    translatedPairs
  };
}
