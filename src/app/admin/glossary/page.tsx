import { redirect } from "next/navigation";
import { AppFrame } from "@/components/AppFrame";
import { AdminGlossaryLibrary } from "@/components/AdminGlossaryLibrary";
import { getCurrentStaff } from "@/lib/session";

export default async function AdminGlossaryPage() {
  const staff = await getCurrentStaff();
  if (!staff) redirect("/login");
  if (staff.role === "staff") redirect("/staff");

  return (
    <AppFrame backHref="/staff" wide>
      <AdminGlossaryLibrary />
    </AppFrame>
  );
}
