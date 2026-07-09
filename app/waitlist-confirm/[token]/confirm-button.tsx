"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { confirmWaitlistSeat } from "@/app/waitlist-confirm/[token]/actions";

export function ConfirmButton({ token }: { token: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);

  async function handleClick() {
    setLoading(true);
    setError(null);
    const result = await confirmWaitlistSeat(token);
    setLoading(false);

    if (result.error) {
      setError(result.error);
      return;
    }
    setConfirmed(true);
  }

  if (confirmed) {
    return <p className="text-sm font-medium text-primary">¡Listo! Tu lugar quedó confirmado.</p>;
  }

  return (
    <div className="space-y-3">
      <Button onClick={handleClick} disabled={loading}>
        {loading && <Loader2 className="animate-spin" />}
        {loading ? "Confirmando..." : "Confirmar mi lugar"}
      </Button>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
