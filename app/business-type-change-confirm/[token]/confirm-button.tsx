"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { confirmBusinessTypeChange } from "@/app/business-type-change-confirm/[token]/actions";

export function ConfirmButton({ token }: { token: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);

  async function handleClick() {
    setLoading(true);
    setError(null);
    const result = await confirmBusinessTypeChange(token);
    setLoading(false);

    if (result.error) {
      setError(result.error);
      return;
    }
    setConfirmed(true);
  }

  if (confirmed) {
    return (
      <p className="text-sm font-medium text-primary">
        Listo. Iniciá sesión en Lazzo para configurar el nuevo tipo de negocio.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <Button variant="destructive" onClick={handleClick} disabled={loading}>
        {loading && <Loader2 className="animate-spin" />}
        {loading ? "Confirmando..." : "Sí, borrar y cambiar tipo de negocio"}
      </Button>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
