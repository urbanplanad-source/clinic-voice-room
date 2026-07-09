import { redirect } from "next/navigation";
import { AppFrame } from "@/components/AppFrame";
import { AdminTranslationSampleManager } from "@/components/AdminTranslationSampleManager";
import { getCurrentStaff } from "@/lib/session";

export default async function AdminSamplesPage() {
  const staff = await getCurrentStaff();
  if (!staff) redirect("/login");
  if (staff.role === "staff") redirect("/staff");

  return (
    <AppFrame backHref="/staff">
      <AdminTranslationSampleManager />
    </AppFrame>
  );
}