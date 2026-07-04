import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AuthShell } from "@/components/auth/auth-shell";
import { ChangePasswordRequest } from "./change-password-request";

export default async function ChangePasswordPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const email = data?.claims?.email as string | undefined;

  if (!email) {
    redirect("/login");
  }

  return (
    <AuthShell>
      <ChangePasswordRequest email={email} />
    </AuthShell>
  );
}
