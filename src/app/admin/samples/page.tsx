import { redirect } from "next/navigation";
import { AppFrame } from "@/components/AppFrame";
import { AdminWorkspaceNav } from "@/components/AdminWorkspaceNav";
import { AdminTranslationQualityWorkspace } from "@/components/AdminTranslationQualityWorkspace";
import { getCurrentStaff } from "@/lib/session";

export default async function AdminSamplesPage() {
  const staff = await getCurrentStaff();
  if (!staff) redirect("/login");
  if (staff.role === "staff") redirect("/staff");

  return (
    <AppFrame backHref="/staff" wide>
      <AdminWorkspaceNav role={staff.role} active="samples" />
      <AdminTranslationQualityWorkspace />
    </AppFrame>
  );
}