"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

export function ConfirmOtpForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = searchParams.get("next") || "/";

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConfirm() {
    if (!tokenHash || !type) return;
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type,
    });

    if (error) {
      setLoading(false);
      setError("Este enlace ya no es válido. Pedí uno nuevo.");
      return;
    }

    router.push(next);
    router.refresh();
  }

  if (!tokenHash || !type) {
    return (
      <p role="alert" className="text-center text-sm text-destructive">
        Este enlace no es válido. Pedí uno nuevo.
      </p>
    );
  }

  return (
    <div className="space-y-3 text-center">
      <div className="space-y-1">
        <h1 className="text-2xl font-black tracking-tight">Confirmar identidad</h1>
        <p className="text-sm text-muted-foreground">
          Hacé clic para confirmar que sos vos y continuar.
        </p>
      </div>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      <Button onClick={handleConfirm} disabled={loading} className="w-full">
        {loading ? "Confirmando..." : "Confirmar"}
      </Button>
    </div>
  );
}
