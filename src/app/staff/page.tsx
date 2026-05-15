import { redirect } from "next/navigation";
import { AppFrame } from "@/components/AppFrame";
import { StaffHome } from "@/components/StaffHome";
import { getCurrentStaff } from "@/lib/session";

export default async function StaffPage() {
  const staff = await getCurrentStaff();
  if (!staff) redirect("/login");

  return (
    <AppFrame narrow>
      <StaffHome
        staff={{
          name: staff.name,
          role: staff.role,
          hospital: { name: staff.hospital.name, planType: staff.hospital.planType }
        }}
      />
    </AppFrame>
  );
}
