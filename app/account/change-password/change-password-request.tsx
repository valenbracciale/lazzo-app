"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

export function ChangePasswordRequest({ email }: { email: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function handleClick() {
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    setLoading(false);

    if (error) {
      setError("No pudimos enviar el email. Intentá de nuevo.");
      return;
    }

    setSent(true);
  }

  return (
    <div className="w-full max-w-sm space-y-6 text-center">
      <div className="space-y-1">
        <h1 className="text-2xl font-black tracking-tight">
          Cambiar contraseña
        </h1>
        <p className="text-sm text-muted-foreground">
          Por seguridad, primero confirmamos tu identidad por email antes de
          dejarte elegir una contraseña nueva.
        </p>
      </div>

      {sent ? (
        <p className="text-sm">
          Te enviamos un enlace a {email}. Revisá tu email y seguí el enlace
          para continuar.
        </p>
      ) : (
        <div className="space-y-3">
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <Button onClick={handleClick} disabled={loading} className="w-full">
            {loading ? "Enviando..." : `Enviar enlace a ${email}`}
          </Button>
        </div>
      )}
    </div>
  );
}
