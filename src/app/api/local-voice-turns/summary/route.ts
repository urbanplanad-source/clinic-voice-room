import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentStaff } from "@/lib/session";
import { clientIp, rateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { isPatientLanguage, languageLabels, type PatientLanguage } from "@/lib/languages";
import { normalizedTextTranslationModel } from "@/lib/openai-models";

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

const turnSchema = z.object({
  speaker: z.enum(["staff", "patient"]),
  koreanText: z.string().trim().min(1).max(1200),
  patientText: z.string().trim().min(1).max(1200),
  createdAt: z.string().trim().max(80).optional()
});

const schema = z.object({
  patientLanguage: z.custom<PatientLanguage>((value) => isPatientLanguage(value)),
  turns: z.array(turnSchema).min(1).max(80)
});

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

function parseSummary(value: string) {
  const objectText = value.match(/\{[\s\S]*\}/)?.[0] ?? "";
  if (!objectText) return null;

  try {
    const parsed = JSON.parse(objectText) as { koreanSummary?: unknown; patientSummary?: unknown };
    if (typeof parsed.koreanSummary !== "string" || typeof parsed.patientSummary !== "string") return null;

    const koreanSummary = parsed.koreanSummary.trim();
    const patientSummary = parsed.patientSummary.trim();
    if (!koreanSummary || !patientSummary) return null;

    return {
      koreanSummary: koreanSummary.slice(0, 1600),
      patientSummary: patientSummary.slice(0, 1600)
    };
  } catch {
    return null;
  }
}

function compactTranscript(turns: z.infer<typeof turnSchema>[], patientLanguage: PatientLanguage) {
  const patientLabel = languageLabels[patientLanguage].english;
  return turns
    .map((turn, index) => {
      const speaker = turn.speaker === "staff" ? "Staff" : "Patient";
      return [
        `${index + 1}. Speaker: ${speaker}`,
        `Korean: ${turn.koreanText}`,
        `${patientLabel}: ${turn.patientText}`
      ].join("\n");
    })
    .join("\n\n");
}

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid local summary request" }, { status: 400 });
  }

  const staff = await getCurrentStaff();
  if (!staff) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limited = await rateLimit({
    key: `local-summary:${clientIp(request)}:${staff.id}:${parsed.data.patientLanguage}`,
    limit: 12,
    windowMs: 60 * 1000
  });
  if (!limited.ok) {
    return rateLimitResponse(limited.retryAfter);
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "OPENAI_API_KEY is not configured" }, { status: 500 });
  }

  const patientLanguage = parsed.data.patientLanguage;
  const patientLabel = languageLabels[patientLanguage].english;
  const transcript = compactTranscript(parsed.data.turns, patientLanguage);
  const model = normalizedTextTranslationModel(process.env.OPENAI_TEXT_TRANSLATION_MODEL);
  const instructions = [
    "You summarize an in-person medical interpretation conversation for a Korean clinic.",
    "Use only facts explicitly present in the transcript. Do not infer diagnoses, promises, consent, prices, medicines, or schedules that were not stated.",
    "Write two concise summaries: one in Korean for staff, and one in the patient's language.",
    `Patient language: ${patientLabel}.`,
    "The patient-language summary must be natural, simple, and easy for a patient to photograph and keep.",
    "Prioritize: main concern, procedure or treatment discussed, key instructions, precautions, next step, reservation, price, medicine, fasting, consent, and follow-up only when mentioned.",
    "If the conversation is too short, summarize only what was said.",
    'Return only JSON like {"koreanSummary":"...","patientSummary":"..."}.'
  ].join("\n");

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "OpenAI-Safety-Identifier": `clinic-voice-room-local-summary-${staff.hospitalId}-${staff.id}-${patientLanguage}`
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
          content: [{ type: "input_text", text: transcript }]
        }
      ]
    })
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    console.error("[local-voice-turns summary]", response.status, detail);
    return NextResponse.json({ error: "Local conversation summary failed" }, { status: 502 });
  }

  const data = (await response.json()) as ResponsesApiResponse;
  const summary = parseSummary(extractOutputText(data));
  if (!summary) {
    return NextResponse.json({ error: "Local conversation summary failed" }, { status: 502 });
  }

  return NextResponse.json(summary);
}
