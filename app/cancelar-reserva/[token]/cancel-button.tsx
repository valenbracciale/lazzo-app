"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { cancelPublicBooking } from "@/app/cancelar-reserva/[token]/actions";

export function CancelButton({ token }: { token: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cancelled, setCancelled] = useState(false);

  async function handleClick() {
    setLoading(true);
    setError(null);
    const result = await cancelPublicBooking(token);
    setLoading(false);

    if (result.error) {
      setError(result.error);
      return;
    }
    setCancelled(true);
  }

  if (cancelled) {
    return <p className="text-sm font-medium text-primary">Listo, cancelamos tu reserva.</p>;
  }

  return (
    <div className="space-y-3">
      <Button variant="destructive" onClick={handleClick} disabled={loading}>
        {loading && <Loader2 className="animate-spin" />}
        {loading ? "Cancelando..." : "Cancelar mi reserva"}
      </Button>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
