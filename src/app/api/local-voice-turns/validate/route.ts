import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentStaff } from "@/lib/session";
import { clientIp, rateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { isPatientLanguage, languageLabels, type PatientLanguage } from "@/lib/languages";
import { normalizedTextTranslationModel } from "@/lib/openai-models";

type LocalDirection = "ko_to_patient" | "patient_to_ko";

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

const schema = z.object({
  patientLanguage: z.custom<PatientLanguage>((value) => isPatientLanguage(value)),
  direction: z.enum(["ko_to_patient", "patient_to_ko"]),
  sourceText: z.string().trim().min(1).max(500),
  translatedText: z.string().trim().min(1).max(500)
});

function compactText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function wordCount(value: string) {
  const compact = compactText(value);
  if (!compact) return 0;
  return compact.split(" ").length;
}

function shouldCheckShortTurn(sourceText: string, translatedText: string) {
  const source = compactText(sourceText);
  const translated = compactText(translatedText);
  return source.length <= 40 || translated.length <= 70 || wordCount(source) <= 5;
}

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

function parseVerifierResult(value: string) {
  const objectText = value.match(/\{[\s\S]*\}/)?.[0] ?? "";
  if (!objectText) return null;
  try {
    const parsed = JSON.parse(objectText) as { ok?: unknown; reason?: unknown };
    if (typeof parsed.ok !== "boolean") return null;
    return {
      ok: parsed.ok,
      reason: typeof parsed.reason === "string" ? parsed.reason.slice(0, 160) : ""
    };
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid validation request" }, { status: 400 });
  }

  const staff = await getCurrentStaff();
  if (!staff) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limited = await rateLimit({
    key: `local-validate:${clientIp(request)}:${staff.id}:${parsed.data.patientLanguage}:${parsed.data.direction}`,
    limit: 60,
    windowMs: 60 * 1000
  });
  if (!limited.ok) {
    return rateLimitResponse(limited.retryAfter);
  }

  const { patientLanguage, direction, sourceText, translatedText } = parsed.data;
  if (!shouldCheckShortTurn(sourceText, translatedText)) {
    return NextResponse.json({ checked: false, ok: true });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ checked: false, ok: true, reason: "OPENAI_API_KEY is not configured" });
  }

  const sourceLanguage = direction === "ko_to_patient" ? "Korean" : languageLabels[patientLanguage].english;
  const targetLanguage = direction === "ko_to_patient" ? languageLabels[patientLanguage].english : "Korean";
  const model = normalizedTextTranslationModel(process.env.OPENAI_TEXT_TRANSLATION_MODEL);
  const instructions = [
    "You validate a short medical interpreter turn.",
    "Decide whether the translated text preserves the same meaning as the source text.",
    `Expected source language: ${sourceLanguage}.`,
    `Expected target language: ${targetLanguage}.`,
    "Accept minor punctuation, politeness, and natural phrasing differences.",
    "Return ok=false if the language is wrong, the meaning changed, an unrelated word appears, or the source and translation do not correspond.",
    'Return only JSON like {"ok":true,"reason":""} or {"ok":false,"reason":"brief reason"}.'
  ].join("\n");

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "OpenAI-Safety-Identifier": `clinic-voice-room-local-validate-${staff.hospitalId}-${staff.id}-${direction}`
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
          content: [
            {
              type: "input_text",
              text: `Source: ${sourceText}\nTranslation: ${translatedText}`
            }
          ]
        }
      ]
    })
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    console.error("[local-voice-turns validate]", response.status, detail);
    return NextResponse.json({ checked: false, ok: true, reason: "validation unavailable" });
  }

  const data = (await response.json()) as ResponsesApiResponse;
  const result = parseVerifierResult(extractOutputText(data));
  if (!result) {
    return NextResponse.json({ checked: false, ok: true, reason: "validation parse skipped" });
  }

  return NextResponse.json({ checked: true, ok: result.ok, reason: result.reason });
}
