import { redirect } from "next/navigation";
import { AppFrame } from "@/components/AppFrame";
import { AdminWorkspaceNav } from "@/components/AdminWorkspaceNav";
import { AdminStaffManager } from "@/components/AdminStaffManager";
import { getCurrentStaff } from "@/lib/session";

export default async function AdminStaffPage() {
  const staff = await getCurrentStaff();
  if (!staff) redirect("/login");
  if (staff.role !== "internal_admin") redirect("/staff");

  return (
    <AppFrame backHref="/staff">
      <AdminWorkspaceNav role={staff.role} active="staff" />
      <AdminStaffManager />
    </AppFrame>
  );
}
