import { redirect } from "next/navigation";
import { AppFrame } from "@/components/AppFrame";
import { StaffTextTranslator } from "@/components/StaffTextTranslator";
import { getCurrentStaff } from "@/lib/session";

export default async function StaffTextTranslatePage() {
  const staff = await getCurrentStaff();
  if (!staff) redirect("/login");

  return (
    <AppFrame backHref="/staff" backLabel="통역 모드 선택">
      <StaffTextTranslator
        staff={{
          name: staff.name,
          hospital: { name: staff.hospital.name }
        }}
      />
    </AppFrame>
  );
}
