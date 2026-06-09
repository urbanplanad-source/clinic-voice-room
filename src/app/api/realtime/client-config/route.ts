import { NextResponse } from "next/server";
import { getCurrentStaff } from "@/lib/session";

export async function GET() {
  const staff = await getCurrentStaff();
  if (!staff) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? "";
  const enabled = Boolean(
    supabaseUrl &&
      supabaseAnonKey &&
      !supabaseUrl.includes("replace-me") &&
      !supabaseAnonKey.includes("replace-me")
  );

  return NextResponse.json(
    enabled
      ? { enabled, supabaseUrl, supabaseAnonKey }
      : { enabled: false },
    {
      headers: {
        "Cache-Control": "no-store"
      }
    }
  );
}
