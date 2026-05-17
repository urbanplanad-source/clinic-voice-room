import { NextResponse } from "next/server";
import { getCurrentStaff } from "@/lib/session";
import { getAdminUsageSummary } from "@/lib/admin-usage";

export async function GET() {
  const staff = await getCurrentStaff();
  if (!staff || staff.role !== "internal_admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json(await getAdminUsageSummary());
}
