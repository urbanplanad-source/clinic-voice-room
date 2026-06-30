import { redirect } from "next/navigation";
import { AppFrame } from "@/components/AppFrame";
import { InstallKioskSetup } from "@/components/InstallKioskSetup";
import { getCurrentStaff } from "@/lib/session";

export default async function StaffKioskPage() {
  const staff = await getCurrentStaff();
  if (!staff) redirect("/login");

  return (
    <AppFrame narrow>
      <InstallKioskSetup
        staff={{
          name: staff.name,
          role: staff.role,
          hospital: { name: staff.hospital.name, planType: staff.hospital.planType }
        }}
      />
    </AppFrame>
  );
}
