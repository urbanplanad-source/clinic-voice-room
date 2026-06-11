import { buildClinicGlossaryInstructions, normalizeClinicTranslation } from "./clinic-glossary";
import { getGlossaryForHospital } from "./glossary-service";
import { languageLabels, patientLanguages, sourceTargetFor, type PatientLanguage } from "./languages";
import { normalizedTextTranslationModel } from "./openai-models";
import type { HospitalSpecialty } from "@prisma/client";

type ResponsesApiContent = {
  type?: string;
  text?: string;
};

type ResponsesApiOutputItem = {
  type?: string;
  content?: ResponsesApiContent[];
};

type ResponsesApiResponse = {
  output_text?: string;
  output?: ResponsesApiOutputItem[];
};

export const quickPhraseStages = ["intake", "medical", "procedure", "price_schedule", "summary"] as const;
export type QuickPhraseStage = (typeof quickPhraseStages)[number];

function extractOutputText(data: ResponsesApiResponse) {
  if (typeof data.output_text === "string") return data.output_text.trim();

  return (
    data.output
      ?.flatMap((item) => item.content ?? [])
      .map((content) => content.text)
      .filter((text): text is string => typeof text === "string")
      .join("")
      .trim() ?? ""
  );
}

function compactManualTranslations(translations?: Record<string, string>) {
  const compact: Partial<Record<PatientLanguage, string>> = {};
  for (const language of patientLanguages) {
    const value = translations?.[language]?.trim();
    if (value) compact[language] = value;
  }
  return compact;
}

export async function translateQuickPhraseForAllLanguages({
  hospitalId,
  specialty,
  ko,
  manualTranslations
}: {
  hospitalId: string;
  specialty: HospitalSpecialty;
  ko: string;
  manualTranslations?: Record<string, string>;
}) {
  const translations = compactManualTranslations(manualTranslations);
  const missingLanguages = patientLanguages.filter((language) => !translations[language]);
  if (missingLanguages.length === 0) return translations;

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured.");
  }

  const glossaryData = await getGlossaryForHospital(hospitalId, specialty);
  const model = normalizedTextTranslationModel(process.env.OPENAI_TEXT_TRANSLATION_MODEL);

  for (const language of missingLanguages) {
    const direction = sourceTargetFor("staff", language);
    const instructions = [
      "You are a professional medical interpreter for a Korean clinic.",
      "Translate this reusable staff phrase for immediate patient display and audio playback.",
      `Target language: ${languageLabels[language].english}.`,
      direction.instructions,
      "Preserve clinical meaning, numbers, brand names, dates, prices, and safety instructions.",
      "Return only the translated sentence. No labels, quotes, markdown, or commentary.",
      buildClinicGlossaryInstructions(language, glossaryData)
    ].join("\n");

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "OpenAI-Safety-Identifier": `clinic-voice-room-quick-phrase-${hospitalId}-${language}`
      },
      body: JSON.stringify({
        model,
        reasoning: { effort: "low" },
        text: { verbosity: "low" },
        input: [
          {
            role: "system",
            content: [{ type: "input_text", text: instructions }]
          },
          {
            role: "user",
            content: [{ type: "input_text", text: ko }]
          }
        ]
      })
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      console.error("[quick-phrases translation]", response.status, detail);
      throw new Error("Quick phrase translation failed.");
    }

    const data = (await response.json()) as ResponsesApiResponse;
    const translatedText = extractOutputText(data);
    if (!translatedText) throw new Error("No quick phrase translation was returned.");
    translations[language] = normalizeClinicTranslation(translatedText, language, glossaryData);
  }

  return translations;
}
