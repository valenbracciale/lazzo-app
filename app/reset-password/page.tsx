import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ResetPasswordForm } from "./reset-password-form";

export default async function ResetPasswordPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const amr = data?.claims?.amr as
    | { method: string; timestamp: number }[]
    | undefined;
  const lastMethod = amr?.[amr.length - 1]?.method;

  // Only allow setting a new password when the session was just established
  // via the recovery email link - not from an ordinary logged-in session.
  // Supabase records recovery-link verification as amr method "otp" (not
  // "recovery"); a normal signInWithPassword session records "password".
  if (lastMethod !== "otp") {
    redirect("/forgot-password?error=recovery-link-required");
  }

  return (
    <div className="flex flex-1 items-center justify-center px-4 py-16">
      <ResetPasswordForm />
    </div>
  );
}
