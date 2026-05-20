import { NextResponse } from "next/server";
import { getCurrentStaff } from "@/lib/session";

export async function GET() {
  const staff = await getCurrentStaff();
  if (!staff) {
    return NextResponse.json({ staff: null }, { status: 401 });
  }

  return NextResponse.json({
    staff: {
      id: staff.id,
      name: staff.name,
      email: staff.email,
      role: staff.role,
      hospital: staff.hospital
    }
  });
}
