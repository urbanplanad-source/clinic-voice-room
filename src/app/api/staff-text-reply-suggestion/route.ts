import { NextResponse } from "next/server";
import { z } from "zod";
import { normalizeClinicTranslation } from "@/lib/clinic-glossary";
import { getGlossaryForHospital } from "@/lib/glossary-service";
import { isPatientLanguage, type PatientLanguage } from "@/lib/languages";
import { generateStaffReplySuggestionWithOpenAI } from "@/lib/openai-staff-reply-suggestion";
import { CriticalNumericTranslationError } from "@/lib/openai-text-translation";
import { clientIp, rateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { getCurrentStaff } from "@/lib/session";

export const maxDuration = 30;

const replySuggestionTimeoutMs = 10_000;

const schema = z.object({
  sourceLanguage: z.custom<PatientLanguage>((value) =>
    isPatientLanguage(value)
  ),
  sourceText: z.string().trim().min(1).max(3000),
  customerMessageKo: z.string().trim().min(1).max(3000)
});

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid reply suggestion request" },
      { status: 400 }
    );
  }

  const staff = await getCurrentStaff();
  if (!staff) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limited = await rateLimit({
    key: `staff-text-reply-suggestion:${clientIp(request)}:${staff.id}`,
    limit: 30,
    windowMs: 60 * 1000
  });
  if (!limited.ok) {
    return rateLimitResponse(limited.retryAfter);
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "OPENAI_API_KEY is not configured" },
      { status: 500 }
    );
  }

  const glossaryData = await getGlossaryForHospital(
    staff.hospitalId,
    staff.hospital.specialty
  );

  try {
    const suggestion = await generateStaffReplySuggestionWithOpenAI({
      apiKey,
      safetyIdentifier:
        `clinic-voice-room-staff-reply-${staff.id}-${parsed.data.sourceLanguage}`,
      sourceLanguage: parsed.data.sourceLanguage,
      customerSourceText: parsed.data.sourceText,
      customerMessageKo: parsed.data.customerMessageKo,
      glossaryData,
      timeoutMs: replySuggestionTimeoutMs
    });

    return NextResponse.json({
      suggestedReplyKo: suggestion.suggestedReplyKo,
      translatedReply: normalizeClinicTranslation(
        suggestion.translatedReply,
        parsed.data.sourceLanguage,
        glossaryData
      ),
      targetLanguage: parsed.data.sourceLanguage,
      model: suggestion.model
    });
  } catch (caught) {
    const errorName = caught instanceof Error
      ? `${caught.name}:${caught.message}`
      : String(caught);
    console.error("[staff-text-reply-suggestion] failed", errorName);

    return NextResponse.json(
      {
        error: caught instanceof CriticalNumericTranslationError
          ? "예상 답변의 숫자나 금액을 안전하게 확인하지 못했습니다."
          : "예상 답변을 만들지 못했습니다."
      },
      { status: 502 }
    );
  }
}
