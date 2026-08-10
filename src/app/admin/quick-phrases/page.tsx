import { redirect } from "next/navigation";
import { AppFrame } from "@/components/AppFrame";
import { AdminWorkspaceNav } from "@/components/AdminWorkspaceNav";
import { AdminQuickPhraseManager } from "@/components/AdminQuickPhraseManager";
import { getCurrentStaff } from "@/lib/session";

export default async function AdminQuickPhrasesPage() {
  const staff = await getCurrentStaff();
  if (!staff) redirect("/login");
  if (staff.role === "staff") redirect("/staff");

  return (
    <AppFrame backHref="/staff">
      <AdminWorkspaceNav role={staff.role} active="quick-phrases" />
      <AdminQuickPhraseManager />
    </AppFrame>
  );
}
