import { redirect } from "next/navigation";
import { AppFrame } from "@/components/AppFrame";
import { AdminWorkspaceNav } from "@/components/AdminWorkspaceNav";
import { AdminFeedbackManager } from "@/components/AdminFeedbackManager";
import { getCurrentStaff } from "@/lib/session";

export default async function AdminFeedbackPage() {
  const staff = await getCurrentStaff();
  if (!staff) redirect("/login");
  if (staff.role === "staff") redirect("/staff");

  return (
    <AppFrame backHref="/staff">
      <AdminWorkspaceNav role={staff.role} active="feedback" />
      <AdminFeedbackManager />
    </AppFrame>
  );
}
