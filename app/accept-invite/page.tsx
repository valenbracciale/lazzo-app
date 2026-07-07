import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AuthShell } from "@/components/auth/auth-shell";
import { AcceptInviteForm } from "./accept-invite-form";

export default async function AcceptInvitePage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const amr = data?.claims?.amr as
    | { method: string; timestamp: number }[]
    | undefined;
  const lastMethod = amr?.[amr.length - 1]?.method;

  // Same reasoning as /reset-password: only allow setting a password when the
  // session was just established via the invite email link, not from an
  // ordinary logged-in session. Supabase records invite-link verification as
  // amr method "otp", same as password recovery.
  if (lastMethod !== "otp") {
    redirect("/login?error=invite-link-required");
  }

  return (
    <AuthShell>
      <AcceptInviteForm />
    </AuthShell>
  );
}
