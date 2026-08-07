import { after, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentStaff } from "@/lib/session";
import { clientIp, rateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { isPatientLanguage, languageLabels, sourceTargetFor, type PatientLanguage } from "@/lib/languages";
import { buildClinicGlossaryInstructions, normalizeClinicTranslation } from "@/lib/clinic-glossary";
import { getGlossaryForHospital } from "@/lib/glossary-service";
import { isPatientRoomRequestAuthorized } from "@/lib/patient-room-session";
import { pendingBackTranslationGuard, runBackTranslationCheck } from "@/lib/back-translation-check";
import { mergeGuardFlags, parseGuardFlags } from "@/lib/guard-flags";
import { translateWithOpenAITextSafety } from "@/lib/openai-text-translation";
import { matchVerifiedSentence } from "@/lib/verified-sentences";
import { broadcastServerTranslationMessage } from "@/lib/supabase-realtime-server";
import { pendingPatientConfirmationGuard } from "@/lib/high-risk-confirmation";

const schema = z.object({
  roomId: z.string(),
  roomToken: z.string().optional(),
  messageId: z.string().min(1).max(120).optional(),
  quickPhraseId: z.string().min(1).max(120).optional(),
  role: z.enum(["staff", "patient"]),
  patientLanguage: z.custom<PatientLanguage>((value) => isPatientLanguage(value)),
  text: z.string().trim().min(1).max(2000)
});

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid translation request" }, { status: 400 });
  }

  const limited = await rateLimit({
    key: `text-translate:${clientIp(request)}:${parsed.data.roomId}:${parsed.data.role}`,
    limit: 60,
    windowMs: 60 * 1000
  });
  if (!limited.ok) {
    return rateLimitResponse(limited.retryAfter);
  }

  const room = await prisma.translationRoom.findUnique({
    where: { id: parsed.data.roomId },
    include: { hospital: { select: { specialty: true } } }
  });
  if (!room || room.status === "ended" || room.patientLanguage !== parsed.data.patientLanguage || room.roomMode !== "consultation") {
    return NextResponse.json({ error: "Room not available" }, { status: 404 });
  }

  if (parsed.data.role === "staff") {
    const staff = await getCurrentStaff();
    if (!staff || staff.id !== room.hostStaffId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  } else if (!(await isPatientRoomRequestAuthorized(room, parsed.data.roomToken))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (parsed.data.messageId) {
    const existingMessage = await prisma.consultationMessage.findFirst({
      where: {
        id: parsed.data.messageId,
        roomId: room.id,
        speaker: parsed.data.role
      }
    });
    if (existingMessage) {
      return NextResponse.json({
        translatedText: existingMessage.text,
        message: {
          id: existingMessage.id,
          speaker: existingMessage.speaker,
          sourceText: existingMessage.sourceText,
          text: existingMessage.text,
          targetLanguage: existingMessage.targetLanguage,
          createdAt: existingMessage.createdAt.toISOString(),
          readAt: existingMessage.readAt?.toISOString() ?? null,
          guardFlags: parseGuardFlags(existingMessage.guardFlags) ?? null
        },
        model: "cached"
      });
    }
  }

  if (parsed.data.quickPhraseId && parsed.data.role === "staff") {
    const quickPhrase = await prisma.hospitalQuickPhrase.findFirst({
      where: {
        id: parsed.data.quickPhraseId,
        hospitalId: room.hospitalId,
        isActive: true
      }
    });
    const translations =
      quickPhrase?.translations && typeof quickPhrase.translations === "object" && !Array.isArray(quickPhrase.translations)
        ? quickPhrase.translations as Record<string, unknown>
        : {};
    const cachedTranslationValue = translations[room.patientLanguage];
    const cachedTranslation = typeof cachedTranslationValue === "string" ? cachedTranslationValue.trim() : "";

    if (quickPhrase && cachedTranslation) {
      const quickPhraseGlossaryData = await getGlossaryForHospital(room.hospitalId, room.hospital.specialty);
      const normalizedText = normalizeClinicTranslation(cachedTranslation, room.patientLanguage, quickPhraseGlossaryData);
      const quickPhraseGuardFlags = pendingPatientConfirmationGuard(quickPhrase.ko, parsed.data.role);
      let message;
      try {
        message = await prisma.$transaction(async (tx) => {
          await tx.translationRoom.update({
            where: { id: room.id },
            data: { lastActiveAt: new Date() }
          });

          return tx.consultationMessage.create({
            data: {
              id: parsed.data.messageId,
              roomId: room.id,
              speaker: parsed.data.role,
              sourceText: quickPhrase.ko,
              text: normalizedText,
              targetLanguage: room.patientLanguage,
              guardFlags: quickPhraseGuardFlags ? quickPhraseGuardFlags as Prisma.InputJsonObject : undefined
            }
          });
        });
      } catch (caught) {
        if (caught instanceof Prisma.PrismaClientKnownRequestError && caught.code === "P2002" && parsed.data.messageId) {
          message = await prisma.consultationMessage.findFirst({
            where: {
              id: parsed.data.messageId,
              roomId: room.id,
              speaker: parsed.data.role
            }
          });
          if (!message) throw caught;
        } else {
          throw caught;
        }
      }

      const messageGuardFlags = parseGuardFlags(message.guardFlags) ?? undefined;
      const messageTargetLanguage = (message.targetLanguage ?? undefined) as PatientLanguage | "ko" | undefined;
      after(() =>
        broadcastServerTranslationMessage(room.id, {
          id: message.id,
          speaker: message.speaker,
          sourceText: message.sourceText ?? undefined,
          text: message.text,
          targetLanguage: messageTargetLanguage,
          createdAt: message.createdAt.toISOString(),
          readAt: message.readAt?.toISOString() ?? null,
          guardFlags: messageGuardFlags
        }).catch((caught) => {
          console.error("[translate-text quick-phrase broadcast]", caught);
        })
      );

      return NextResponse.json({
        translatedText: normalizedText,
        message: {
          id: message.id,
          speaker: message.speaker,
          sourceText: message.sourceText,
          text: message.text,
          targetLanguage: message.targetLanguage,
          createdAt: message.createdAt.toISOString(),
          readAt: message.readAt?.toISOString() ?? null,
          guardFlags: messageGuardFlags ?? null
        },
        model: "quick_phrase"
      });
    }
  }

  const direction = sourceTargetFor(parsed.data.role, room.patientLanguage);
  const targetLanguage = parsed.data.role === "staff" ? room.patientLanguage : "ko";
  const targetLabel = targetLanguage === "ko" ? "Korean" : languageLabels[room.patientLanguage].english;
  const glossaryData = await getGlossaryForHospital(room.hospitalId, room.hospital.specialty);

  const verifiedMatch = matchVerifiedSentence(parsed.data.text, targetLanguage, glossaryData);
  if (verifiedMatch) {
    const normalizedText = normalizeClinicTranslation(verifiedMatch.translatedText, targetLanguage, glossaryData);
    const verifiedGuardFlags = pendingPatientConfirmationGuard(parsed.data.text, parsed.data.role);
    let message;
    try {
      message = await prisma.$transaction(async (tx) => {
        await tx.translationRoom.update({
          where: { id: room.id },
          data: { lastActiveAt: new Date() }
        });

        return tx.consultationMessage.create({
          data: {
            id: parsed.data.messageId,
            roomId: room.id,
            speaker: parsed.data.role,
            sourceText: parsed.data.text,
            text: normalizedText,
            targetLanguage,
            guardFlags: verifiedGuardFlags ? verifiedGuardFlags as Prisma.InputJsonObject : undefined
          }
        });
      });
    } catch (caught) {
      if (caught instanceof Prisma.PrismaClientKnownRequestError && caught.code === "P2002" && parsed.data.messageId) {
        message = await prisma.consultationMessage.findFirst({
          where: {
            id: parsed.data.messageId,
            roomId: room.id,
            speaker: parsed.data.role
          }
        });
        if (!message) throw caught;
      } else {
        throw caught;
      }
    }

    const messageGuardFlags = parseGuardFlags(message.guardFlags) ?? undefined;
    const messageTargetLanguage = (message.targetLanguage ?? undefined) as PatientLanguage | "ko" | undefined;
    after(() =>
      broadcastServerTranslationMessage(room.id, {
        id: message.id,
        speaker: message.speaker,
        sourceText: message.sourceText ?? undefined,
        text: message.text,
        targetLanguage: messageTargetLanguage,
        createdAt: message.createdAt.toISOString(),
        readAt: message.readAt?.toISOString() ?? null,
        guardFlags: messageGuardFlags
      }).catch((caught) => {
        console.error("[translate-text verified broadcast]", caught);
      })
    );

    return NextResponse.json({
      translatedText: normalizedText,
      message: {
        id: message.id,
        speaker: message.speaker,
        sourceText: message.sourceText,
        text: message.text,
        targetLanguage: message.targetLanguage,
        createdAt: message.createdAt.toISOString(),
        readAt: message.readAt?.toISOString() ?? null,
        guardFlags: messageGuardFlags ?? null
      },
      model: "verified"
    });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "OPENAI_API_KEY is not configured" }, { status: 500 });
  }

  const instructions = [
    "You are a professional medical interpreter for a dermatology and plastic surgery clinic.",
    "Translate the user's message accurately and naturally for a live consultation.",
    `Target language: ${targetLabel}.`,
    direction.instructions,
    "Preserve the original clinical meaning. Do not add advice, diagnosis, consent language, or extra explanation.",
    "If the source text is ambiguous, keep the translation concise and neutral rather than guessing.",
    "Return only the translated text. No labels, quotes, markdown, or commentary.",
    buildClinicGlossaryInstructions(room.patientLanguage, glossaryData)
  ].join("\n");

  let translation;
  try {
    translation = await translateWithOpenAITextSafety({
      apiKey,
      safetyIdentifier: `clinic-voice-room-text-${room.id}-${parsed.data.role}`,
      sourceText: parsed.data.text,
      instructions,
      glossaryData,
      errorLabel: "[translate-text]",
      context: "translate-text"
    });
  } catch (caught) {
    if (caught instanceof Error && caught.message === "empty_translation") {
      return NextResponse.json({ error: "No translated text was returned" }, { status: 502 });
    }
    return NextResponse.json({ error: "Text translation failed" }, { status: 502 });
  }

  if (!translation.translatedText) {
    return NextResponse.json({ error: "No translated text was returned" }, { status: 502 });
  }

  const normalizedText = normalizeClinicTranslation(translation.translatedText, targetLanguage, glossaryData);
  const guardFlags = mergeGuardFlags(
    mergeGuardFlags(
      translation.guardFlags,
      pendingBackTranslationGuard({
        sourceText: parsed.data.text,
        role: parsed.data.role,
        targetLanguage,
        translationSource: "llm"
      })
    ),
    pendingPatientConfirmationGuard(parsed.data.text, parsed.data.role)
  );
  let message;
  try {
    message = await prisma.$transaction(async (tx) => {
      await tx.translationRoom.update({
        where: { id: room.id },
        data: { lastActiveAt: new Date() }
      });

      return tx.consultationMessage.create({
        data: {
          id: parsed.data.messageId,
          roomId: room.id,
          speaker: parsed.data.role,
          sourceText: parsed.data.text,
          text: normalizedText,
          targetLanguage,
          guardFlags: guardFlags ? guardFlags as Prisma.InputJsonObject : undefined
        }
      });
    });
  } catch (caught) {
    if (caught instanceof Prisma.PrismaClientKnownRequestError && caught.code === "P2002" && parsed.data.messageId) {
      message = await prisma.consultationMessage.findFirst({
        where: {
          id: parsed.data.messageId,
          roomId: room.id,
          speaker: parsed.data.role
        }
      });
      if (!message) throw caught;
    } else {
      throw caught;
    }
  }

  if (guardFlags?.backTranslation?.status === "pending") {
    after(() =>
      runBackTranslationCheck({
        roomId: room.id,
        messageId: message.id,
        sourceText: parsed.data.text,
        translatedText: normalizedText,
        patientLanguage: room.patientLanguage
      })
    );
  }

  const messageGuardFlags = parseGuardFlags(message.guardFlags) ?? undefined;
  const messageTargetLanguage = (message.targetLanguage ?? undefined) as PatientLanguage | "ko" | undefined;
  after(() =>
    broadcastServerTranslationMessage(room.id, {
      id: message.id,
      speaker: message.speaker,
      sourceText: message.sourceText ?? undefined,
      text: message.text,
      targetLanguage: messageTargetLanguage,
      createdAt: message.createdAt.toISOString(),
      readAt: message.readAt?.toISOString() ?? null,
      guardFlags: messageGuardFlags
    }).catch((caught) => {
      console.error("[translate-text broadcast]", caught);
    })
  );

  return NextResponse.json({
    translatedText: normalizedText,
    message: {
      id: message.id,
      speaker: message.speaker,
      sourceText: message.sourceText,
      text: message.text,
      targetLanguage: message.targetLanguage,
      createdAt: message.createdAt.toISOString(),
      readAt: message.readAt?.toISOString() ?? null,
      guardFlags: messageGuardFlags ?? null
    },
    model: translation.model
  });
}
