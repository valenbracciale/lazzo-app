"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";

export function SettingsView({
  businessId,
  businessName,
}: {
  businessId: string;
  businessName: string;
}) {
  const router = useRouter();
  const [name, setName] = useState(businessName);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setSaved(false);

    const supabase = createClient();
    const { error: updateError } = await supabase
      .from("businesses")
      .update({ name })
      .eq("id", businessId);

    setLoading(false);

    if (updateError) {
      setError("No pudimos guardar el nombre. Probá de nuevo.");
      return;
    }

    setSaved(true);
    router.refresh();
  }

  return (
    <div className="duration-300 animate-in fade-in-0 mx-auto max-w-xl space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Datos del negocio</CardTitle>
          <CardDescription>
            Este nombre aparece en el panel y en las comunicaciones con tus
            clientes.
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-1.5">
            <Label htmlFor="business-name">Nombre del negocio</Label>
            <Input
              id="business-name"
              required
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setSaved(false);
              }}
            />
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
            {saved && (
              <p className="text-sm text-muted-foreground">
                Cambios guardados.
              </p>
            )}
          </CardContent>
          <CardFooter className="justify-end">
            <Button type="submit" disabled={loading || name === businessName}>
              {loading && <Loader2 className="animate-spin" />}
              {loading ? "Guardando..." : "Guardar cambios"}
            </Button>
          </CardFooter>
        </form>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Cuenta</CardTitle>
          <CardDescription>
            Gestioná tu acceso a Lazzo.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button variant="outline" asChild>
            <Link href="/account/change-password">Cambiar contraseña</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/account/change-email">Cambiar email</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
