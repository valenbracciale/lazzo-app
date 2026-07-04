import { Suspense } from "react";
import { AuthShell } from "@/components/auth/auth-shell";
import { ConfirmOtpForm } from "@/components/auth/confirm-otp-form";

export default function ConfirmPage() {
  return (
    <AuthShell>
      <Suspense>
        <ConfirmOtpForm />
      </Suspense>
    </AuthShell>
  );
}
