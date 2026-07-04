"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ChangeEmailForm({ currentEmail }: { currentEmail: string }) {
  const [newEmail, setNewEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { error } = await supabase.auth.updateUser(
      { email: newEmail },
      { emailRedirectTo: `${window.location.origin}/` }
    );

    setLoading(false);

    if (error) {
      setError("No pudimos iniciar el cambio de email. Intentá de nuevo.");
      return;
    }

    setSent(true);
  }

  return (
    <div className="w-full max-w-sm space-y-6 text-center">
      <div className="space-y-1">
        <h1 className="text-2xl font-black tracking-tight">Cambiar email</h1>
        <p className="text-sm text-muted-foreground">
          Actualmente: {currentEmail}. Por seguridad, vamos a pedirte que
          confirmes el cambio desde tu email actual y desde el nuevo.
        </p>
      </div>

      {sent ? (
        <p className="text-sm">
          Revisá tu email actual y el nuevo — tenés que confirmar los dos
          para que el cambio se aplique.
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4 text-left">
          <div className="space-y-1.5">
            <Label htmlFor="new-email">Email nuevo</Label>
            <Input
              id="new-email"
              name="new-email"
              type="email"
              autoComplete="email"
              required
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
            />
          </div>

          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Enviando..." : "Confirmar cambio"}
          </Button>
        </form>
      )}
    </div>
  );
}
