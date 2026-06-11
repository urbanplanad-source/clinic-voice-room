import type { ClinicGlossaryData } from "./clinic-glossary";
import { extractNumericSignature } from "./number-guard";
import { normalizedTextTranslationModel } from "./openai-models";
import { detectHighRisk } from "./risk-detector";
import { normalizeForMatch } from "./verified-sentences";

export type TranslationModelRoute = {
  tier: "light" | "standard";
  model: string;
  standardModel: string;
  reason: string;
};

function hasGlossaryTermHit(text: string, glossaryData: ClinicGlossaryData) {
  const normalizedText = normalizeForMatch(text);
  if (!normalizedText) return false;

  return glossaryData.terms.some((entry) => {
    const candidates = [entry.standardKo, ...entry.spoken];
    return candidates.some((candidate) => {
      const normalizedCandidate = normalizeForMatch(candidate);
      return normalizedCandidate && normalizedText.includes(normalizedCandidate);
    });
  });
}

export function routeTranslationModel(text: string, glossaryData: ClinicGlossaryData): TranslationModelRoute {
  const standardModel = normalizedTextTranslationModel(process.env.OPENAI_TEXT_TRANSLATION_MODEL);
  const lightModel = process.env.OPENAI_TEXT_TRANSLATION_MODEL_LIGHT?.trim();
  if (!lightModel) {
    return { tier: "standard", model: standardModel, standardModel, reason: "light_env_unset" };
  }

  const normalizedText = text.normalize("NFKC").trim();
  if (normalizedText.length > 30) {
    return { tier: "standard", model: standardModel, standardModel, reason: "long_text" };
  }

  if (extractNumericSignature(text).length > 0) {
    return { tier: "standard", model: standardModel, standardModel, reason: "number_present" };
  }

  if (hasGlossaryTermHit(text, glossaryData)) {
    return { tier: "standard", model: standardModel, standardModel, reason: "glossary_hit" };
  }

  if (detectHighRisk(text).isHighRisk) {
    return { tier: "standard", model: standardModel, standardModel, reason: "high_risk" };
  }

  return { tier: "light", model: lightModel, standardModel, reason: "eligible" };
}

export function logModelRoute(context: string, route: TranslationModelRoute) {
  console.log("[model-router]", JSON.stringify({ context, tier: route.tier, model: route.model, reason: route.reason }));
}
