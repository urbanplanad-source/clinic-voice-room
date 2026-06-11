import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentStaff } from "@/lib/session";

const statuses = ["new", "reviewed", "fixed", "dismissed"] as const;

const patchSchema = z.object({
  id: z.string().min(1),
  status: z.enum(statuses).optional(),
  reason: z.string().trim().max(500).nullable().optional()
});

type FeedbackAdmin = NonNullable<Awaited<ReturnType<typeof getCurrentStaff>>>;

async function requireFeedbackAdmin() {
  const staff = await getCurrentStaff();
  if (!staff || staff.role === "staff") return null;
  return staff;
}

function feedbackWhereFromRequest(request: Request, admin: FeedbackAdmin): Prisma.TranslationFeedbackWhereInput {
  const url = new URL(request.url);
  const id = url.searchParams.get("id") || undefined;
  const status = url.searchParams.get("status") || undefined;
  const hospitalId = url.searchParams.get("hospitalId") || undefined;
  const where: Prisma.TranslationFeedbackWhereInput = {};

  if (id) where.id = id;
  if (admin.role === "hospital_admin") {
    where.hospitalId = admin.hospitalId;
  } else if (hospitalId) {
    where.hospitalId = hospitalId;
  }
  if (status && statuses.includes(status as (typeof statuses)[number])) {
    where.status = status as Prisma.EnumFeedbackStatusFilter["equals"];
  }

  return where;
}

function feedbackResponse(feedback: {
  id: string;
  hospitalId: string;
  hospital?: { id: string; name: string; slug: string } | null;
  roomId: string | null;
  messageId: string | null;
  sourceText: string;
  translatedText: string;
  sourceLanguage: string;
  targetLanguage: string;
  reporterRole: string;
  reason: string | null;
  status: (typeof statuses)[number];
  createdAt: Date;
  reviewedAt: Date | null;
}) {
  return {
    ...feedback,
    createdAt: feedback.createdAt.toISOString(),
    reviewedAt: feedback.reviewedAt?.toISOString() ?? null
  };
}

export async function GET(request: Request) {
  const admin = await requireFeedbackAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  const where = feedbackWhereFromRequest(request, admin);
  const feedback = await prisma.translationFeedback.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: { hospital: { select: { id: true, name: true, slug: true } } },
    take: where.id ? 1 : 200
  });

  const hospitals =
    admin.role === "internal_admin"
      ? await prisma.hospital.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, slug: true } })
      : [];

  return NextResponse.json({
    feedback: where.id ? (feedback[0] ? feedbackResponse(feedback[0]) : null) : feedback.map(feedbackResponse),
    hospitals,
    statuses
  });
}

export async function PATCH(request: Request) {
  const admin = await requireFeedbackAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  const parsed = patchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid feedback update payload" }, { status: 400 });
  }

  const existing = await prisma.translationFeedback.findUnique({ where: { id: parsed.data.id } });
  if (!existing || (admin.role === "hospital_admin" && existing.hospitalId !== admin.hospitalId)) {
    return NextResponse.json({ error: "Feedback not found" }, { status: 404 });
  }

  const feedback = await prisma.translationFeedback.update({
    where: { id: parsed.data.id },
    data: {
      ...("status" in parsed.data ? { status: parsed.data.status, reviewedAt: parsed.data.status === "new" ? null : new Date() } : {}),
      ...("reason" in parsed.data ? { reason: parsed.data.reason ?? null } : {})
    },
    include: { hospital: { select: { id: true, name: true, slug: true } } }
  });

  return NextResponse.json({ feedback: feedbackResponse(feedback) });
}
