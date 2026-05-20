import { redirect } from "next/navigation";
import { AppFrame } from "@/components/AppFrame";
import { LoginForm } from "@/components/LoginForm";
import { getCurrentStaff } from "@/lib/session";

export default async function LoginPage() {
  const staff = await getCurrentStaff();
  if (staff) redirect("/staff");

  return (
    <AppFrame narrow>
      <LoginForm />
    </AppFrame>
  );
}
