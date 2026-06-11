import { redirect } from "next/navigation";
import { AppFrame } from "@/components/AppFrame";
import { AdminQuickPhraseManager } from "@/components/AdminQuickPhraseManager";
import { getCurrentStaff } from "@/lib/session";

export default async function AdminQuickPhrasesPage() {
  const staff = await getCurrentStaff();
  if (!staff) redirect("/login");
  if (staff.role === "staff") redirect("/staff");

  return (
    <AppFrame backHref="/staff">
      <AdminQuickPhraseManager />
    </AppFrame>
  );
}
