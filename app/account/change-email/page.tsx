import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AuthShell } from "@/components/auth/auth-shell";
import { ChangeEmailForm } from "./change-email-form";

export default async function ChangeEmailPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const email = data?.claims?.email as string | undefined;

  if (!email) {
    redirect("/login");
  }

  return (
    <AuthShell>
      <ChangeEmailForm currentEmail={email} />
    </AuthShell>
  );
}
