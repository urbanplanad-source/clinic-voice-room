import { redirect } from "next/navigation";
import { AppFrame } from "@/components/AppFrame";
import { AdminDatasetDryRun } from "@/components/AdminDatasetDryRun";
import { getCurrentStaff } from "@/lib/session";

export default async function AdminDatasetsPage() {
  const staff = await getCurrentStaff();
  if (!staff) redirect("/login");
  if (staff.role === "staff") redirect("/staff");

  return (
    <AppFrame backHref="/admin/glossary" wide>
      <AdminDatasetDryRun />
    </AppFrame>
  );
}

