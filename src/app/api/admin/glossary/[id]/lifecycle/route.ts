import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentStaff } from "@/lib/session";
import { clearGlossaryCache, findGlossaryAliasConflict } from "@/lib/glossary-service";

const schema = z.object({
  action: z.enum(["approve", "activate", "new_version", "retire", "rollback"])
});

async function authorizedEntry(id: string) {
  const staff = await getCurrentStaff();
  if (!staff || staff.role === "staff") return null;
  const entry = await prisma.glossaryEntry.findUnique({ where: { id } });
  if (!entry) return null;
  if (staff.role === "hospital_admin" && (entry.scope !== "hospital" || entry.hospitalId !== staff.hospitalId)) return null;
  return { staff, entry };
}

function copyVersionData(entry: NonNullable<Awaited<ReturnType<typeof prisma.glossaryEntry.findUnique>>>) {
  return {
    scope: entry.scope,
    specialty: entry.specialty,
    hospitalId: entry.hospitalId,
    entryType: entry.entryType,
    spokenForms: entry.spokenForms,
    standardKo: entry.standardKo,
    translations: entry.translations as Prisma.InputJsonValue,
    category: entry.category,
    note: entry.note,
    priority: entry.priority,
    lineageId: entry.lineageId
  };
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const authorized = await authorizedEntry(id);
  if (!authorized) return NextResponse.json({ error: "Glossary entry not found" }, { status: 404 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid lifecycle action" }, { status: 400 });

  const { staff, entry } = authorized;
  const now = new Date();
  let result;

  if (parsed.data.action === "approve") {
    if (entry.lifecycle !== "draft") return NextResponse.json({ error: "초안만 승인할 수 있습니다." }, { status: 409 });
    result = await prisma.glossaryEntry.update({
      where: { id },
      data: { lifecycle: "approved", approvedById: staff.id, approvedAt: now, isActive: false }
    });
  } else if (parsed.data.action === "activate") {
    if (entry.lifecycle !== "approved") return NextResponse.json({ error: "승인된 버전만 배포할 수 있습니다." }, { status: 409 });
    const conflict = await findGlossaryAliasConflict({
      entryType: entry.entryType,
      standardKo: entry.standardKo,
      spokenForms: entry.spokenForms,
      excludeId: entry.id
    });
    if (conflict) return NextResponse.json({ error: `${conflict.spokenForm} is already mapped to ${conflict.standardKo}` }, { status: 409 });

    result = await prisma.$transaction(async (tx) => {
      await tx.glossaryEntry.updateMany({
        where: { lineageId: entry.lineageId, lifecycle: "active", id: { not: entry.id } },
        data: { lifecycle: "retired", isActive: false, retiredAt: now }
      });
      return tx.glossaryEntry.update({
        where: { id: entry.id },
        data: { lifecycle: "active", isActive: true, activatedById: staff.id, activatedAt: now, retiredAt: null }
      });
    });
  } else if (parsed.data.action === "new_version") {
    if (entry.lifecycle === "draft") return NextResponse.json({ error: "이미 수정 가능한 초안입니다." }, { status: 409 });
    const latest = await prisma.glossaryEntry.aggregate({ where: { lineageId: entry.lineageId }, _max: { version: true } });
    result = await prisma.glossaryEntry.create({
      data: {
        ...copyVersionData(entry),
        version: (latest._max.version ?? entry.version) + 1,
        lifecycle: "draft",
        isActive: false
      }
    });
  } else if (parsed.data.action === "retire") {
    if (entry.lifecycle !== "active") return NextResponse.json({ error: "배포 중인 버전만 중지할 수 있습니다." }, { status: 409 });
    result = await prisma.glossaryEntry.update({
      where: { id },
      data: { lifecycle: "retired", isActive: false, retiredAt: now }
    });
  } else {
    if (entry.lifecycle === "draft") return NextResponse.json({ error: "초안으로는 롤백할 수 없습니다." }, { status: 409 });
    const latest = await prisma.glossaryEntry.aggregate({ where: { lineageId: entry.lineageId }, _max: { version: true } });
    result = await prisma.$transaction(async (tx) => {
      await tx.glossaryEntry.updateMany({
        where: { lineageId: entry.lineageId, lifecycle: "active" },
        data: { lifecycle: "retired", isActive: false, retiredAt: now }
      });
      return tx.glossaryEntry.create({
        data: {
          ...copyVersionData(entry),
          version: (latest._max.version ?? entry.version) + 1,
          lifecycle: "active",
          isActive: true,
          approvedById: staff.id,
          approvedAt: now,
          activatedById: staff.id,
          activatedAt: now
        }
      });
    });
  }

  clearGlossaryCache(entry.hospitalId, entry.specialty);
  return NextResponse.json({ entry: result });
}
