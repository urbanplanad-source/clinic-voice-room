import { Prisma, type ParticipantRole } from "@prisma/client";
import type { GlossaryTargetLanguage } from "./clinic-glossary";
import type { GuardFlags, BackTranslationGuard } from "./guard-flags";
import { mergeGuardFlags, parseGuardFlags } from "./guard-flags";
import { normalizedTextTranslationModel } from "./openai-models";
import { prisma } from "./prisma";
import { detectHighRisk } from "./risk-detector";
import { broadcastServerTranslationMessage } from "./supabase-realtime-server";

type TranslationSource = "llm" | "realtime" | "verified" | "quick_phrase" | "cached";

type ResponsesApiResponse = {
  output_text?: string;
  output?: Array<{ content?: Array<{ text?: string }> }>;
};

const roomLocks = new Set<string>();

export function backTranslationEnabled() {
  return process.env.BACK_TRANSLATION_CHECK === "on";
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

export function pendingBackTranslationGuard(params: {
  sourceText: string;
  role: ParticipantRole;
  targetLanguage: GlossaryTargetLanguage;
  translationSource: TranslationSource;
}): GuardFlags | undefined {
  if (!backTranslationEnabled()) return undefined;
  if (params.role !== "staff" || params.targetLanguage === "ko") return undefined;
  if (params.translationSource === "cached" || params.translationSource === "quick_phrase" || params.translationSource === "verified") return undefined;

  const risk = detectHighRisk(params.sourceText);
  if (!risk.isHighRisk) return undefined;

  return {
    backTranslation: {
      status: "pending",
      categories: risk.categories
    }
  };
}

async function callResponses(params: {
  apiKey: string;
  model: string;
  safetyIdentifier: string;
  instructions: string;
  input: string;
  signal: AbortSignal;
}) {
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    signal: params.signal,
    headers: {
      Authorization: `Bearer ${params.apiKey}`,
      "Content-Type": "application/json",
      "OpenAI-Safety-Identifier": params.safetyIdentifier
    },
    body: JSON.stringify({
      model: params.model,
      reasoning: { effort: "low" },
      text: { verbosity: "low" },
      input: [
        { role: "system", content: [{ type: "input_text", text: params.instructions }] },
        { role: "user", content: [{ type: "input_text", text: params.input }] }
      ]
    })
  });

  if (!response.ok) throw new Error(`responses_api_${response.status}`);
  return extractOutputText((await response.json()) as ResponsesApiResponse);
}

function parseVerdict(text: string): { verdict: "pass" | "fail"; reason?: string } {
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : text) as { verdict?: unknown; reason?: unknown };
  return {
    verdict: parsed.verdict === "pass" ? "pass" : "fail",
    reason: typeof parsed.reason === "string" ? parsed.reason : undefined
  };
}

async function updateBackTranslationGuard(messageId: string, guard: BackTranslationGuard) {
  const message = await prisma.consultationMessage.findUnique({
    where: { id: messageId },
    select: {
      id: true,
      roomId: true,
      speaker: true,
      sourceText: true,
      text: true,
      targetLanguage: true,
      createdAt: true,
      readAt: true,
      guardFlags: true
    }
  });
  if (!message) return;

  const merged = mergeGuardFlags(message.guardFlags, { backTranslation: guard });
  const updated = await prisma.consultationMessage.update({
    where: { id: message.id },
    data: { guardFlags: merged as Prisma.InputJsonObject },
    select: {
      id: true,
      speaker: true,
      sourceText: true,
      text: true,
      targetLanguage: true,
      createdAt: true,
      readAt: true,
      guardFlags: true
    }
  });

  await broadcastServerTranslationMessage(message.roomId, {
    id: updated.id,
    speaker: updated.speaker,
    sourceText: updated.sourceText ?? undefined,
    text: updated.text,
    targetLanguage: updated.targetLanguage as GlossaryTargetLanguage | undefined,
    createdAt: updated.createdAt.toISOString(),
    readAt: updated.readAt?.toISOString() ?? null,
    guardFlags: parseGuardFlags(updated.guardFlags)
  });
}

export async function runBackTranslationCheck(params: {
  roomId: string;
  messageId: string;
  sourceText: string;
  translatedText: string;
  patientLanguage: string;
}) {
  if (!backTranslationEnabled()) return;

  if (roomLocks.has(params.roomId)) {
    await updateBackTranslationGuard(params.messageId, { status: "skipped", reason: "room check already running" });
    return;
  }

  roomLocks.add(params.roomId);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);

  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      await updateBackTranslationGuard(params.messageId, { status: "skipped", reason: "OPENAI_API_KEY is not configured" });
      return;
    }

    const model = process.env.OPENAI_TEXT_TRANSLATION_MODEL_LIGHT?.trim() || normalizedTextTranslationModel(process.env.OPENAI_TEXT_TRANSLATION_MODEL);
    const backText = await callResponses({
      apiKey,
      model,
      safetyIdentifier: `clinic-voice-room-back-translation-${params.roomId}`,
      instructions: "Translate the message back into Korean for medical translation verification. Return only Korean text.",
      input: params.translatedText,
      signal: controller.signal
    });
    if (!backText) throw new Error("empty_back_translation");

    const verdictText = await callResponses({
      apiKey,
      model,
      safetyIdentifier: `clinic-voice-room-back-translation-compare-${params.roomId}`,
      instructions: [
        "Compare two Korean medical consultation sentences.",
        "Decide whether they have the same clinical meaning.",
        "Return only JSON: {\"verdict\":\"pass\"|\"fail\",\"reason\":\"short Korean reason\"}."
      ].join("\n"),
      input: `Original Korean:\n${params.sourceText}\n\nBack translation:\n${backText}`,
      signal: controller.signal
    });
    const verdict = parseVerdict(verdictText);

    await updateBackTranslationGuard(params.messageId, {
      status: verdict.verdict,
      backText,
      reason: verdict.reason
    });
  } catch (caught) {
    console.error("[back-translation-check] skipped", caught);
    await updateBackTranslationGuard(params.messageId, { status: "skipped", reason: "verification failed or timed out" });
  } finally {
    clearTimeout(timer);
    roomLocks.delete(params.roomId);
  }
}
