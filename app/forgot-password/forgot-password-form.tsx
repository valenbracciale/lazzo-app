"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Logo } from "@/components/landing/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ForgotPasswordForm() {
  const searchParams = useSearchParams();
  const recoveryRequired = searchParams.get("error") === "recovery-link-required";

  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
    });

    setLoading(false);

    if (error) {
      setError("No pudimos enviar el email. Intentá de nuevo.");
      return;
    }

    setSent(true);
  }

  return (
    <div className="w-full max-w-sm space-y-6">
      <div className="flex justify-center">
        <Link href="/">
          <Logo />
        </Link>
      </div>
      <div className="space-y-1 text-center">
        <h1 className="text-2xl font-black tracking-tight">
          Recuperar contraseña
        </h1>
        <p className="text-sm text-muted-foreground">
          Te enviamos un enlace para elegir una contraseña nueva.
        </p>
      </div>

      {recoveryRequired && !sent && (
        <p role="alert" className="text-center text-sm text-destructive">
          Para cambiar tu contraseña primero tenés que confirmar tu
          identidad por email. Pedí un enlace nuevo.
        </p>
      )}

      {sent ? (
        <p className="text-center text-sm">
          Revisá tu email ({email}) y seguí el enlace para continuar.
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Enviando..." : "Enviar enlace"}
          </Button>
        </form>
      )}

      <p className="text-center text-sm text-muted-foreground">
        <Link href="/login" className="underline underline-offset-4">
          Volver a iniciar sesión
        </Link>
      </p>
    </div>
  );
}
