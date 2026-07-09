import { NextResponse } from "next/server";
import { getCurrentStaff } from "@/lib/session";
import { endStaleRooms } from "@/lib/stale-rooms";
import { getStaleRoomMinutes } from "@/lib/room-limits";
import { deleteExpiredTranslationSamples, getTranslationSampleRetentionCutoff, getTranslationSampleRetentionDays } from "@/lib/translation-samples";

function isAuthorizedCron(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

async function cleanupResponse() {
  const result = await endStaleRooms();
  const translationSampleRetentionDays = getTranslationSampleRetentionDays();
  let expiredTranslationSampleDeletedCount = 0;
  let translationSampleCleanupError = false;
  const translationSampleCutoff = getTranslationSampleRetentionCutoff(new Date(), translationSampleRetentionDays);

  try {
    const sampleCleanup = await deleteExpiredTranslationSamples({ retentionDays: translationSampleRetentionDays });
    expiredTranslationSampleDeletedCount = sampleCleanup.deletedCount;
  } catch (caught) {
    translationSampleCleanupError = true;
    console.error("[cleanup-stale translation samples]", caught);
  }

  return NextResponse.json({
    ...result,
    staleRoomMinutes: getStaleRoomMinutes(),
    translationSampleRetentionDays,
    translationSampleCutoff,
    expiredTranslationSampleDeletedCount,
    translationSampleCleanupError
  });
}

export async function GET(request: Request) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return cleanupResponse();
}

export async function POST(request: Request) {
  const staff = await getCurrentStaff();
  if (!isAuthorizedCron(request) && staff?.role !== "internal_admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return cleanupResponse();
}
