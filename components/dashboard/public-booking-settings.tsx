"use client";

import { useState } from "react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { slugify } from "@/lib/utils";
import { updatePublicBookingSettings } from "@/app/dashboard/settings/actions";

export function PublicBookingSettings({
  businessName,
  origin,
  initialSlug,
  initialEnabled,
  initialMinAdvanceMinutes,
  initialMaxAdvanceDays,
}: {
  businessName: string;
  origin: string;
  initialSlug: string;
  initialEnabled: boolean;
  initialMinAdvanceMinutes: number;
  initialMaxAdvanceDays: number;
}) {
  const [slug, setSlug] = useState(initialSlug || slugify(businessName));
  const [enabled, setEnabled] = useState(initialEnabled);
  const [minAdvanceMinutes, setMinAdvanceMinutes] = useState(initialMinAdvanceMinutes);
  const [maxAdvanceDays, setMaxAdvanceDays] = useState(initialMaxAdvanceDays);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const publicUrl = `${origin}/reservar/${slug || "..."}`;

  async function handleSave() {
    setSaving(true);
    setError(null);
    setSaved(false);

    const result = await updatePublicBookingSettings({
      slug,
      enabled,
      minAdvanceMinutes,
      maxAdvanceDays,
    });

    setSaving(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setSaved(true);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Reserva pública</CardTitle>
        <CardDescription>
          Dejá que tus clientes reserven su turno solos, sin necesidad de crear una cuenta.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            className="size-4"
          />
          Activar reserva pública
        </label>

        <div className="space-y-1.5">
          <Label htmlFor="public_booking_slug">Link</Label>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="shrink-0">{origin}/reservar/</span>
            <Input
              id="public_booking_slug"
              value={slug}
              onChange={(e) => setSlug(slugify(e.target.value))}
              className="text-foreground"
            />
          </div>
          {enabled && !error && (
            <p className="text-xs text-muted-foreground">
              Compartí este link con tus clientes: <span className="font-mono">{publicUrl}</span>
            </p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="min_advance">Anticipación mínima (minutos)</Label>
            <Input
              id="min_advance"
              type="number"
              min={0}
              value={minAdvanceMinutes}
              onChange={(e) => setMinAdvanceMinutes(Number(e.target.value) || 0)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="max_advance">Anticipación máxima (días)</Label>
            <Input
              id="max_advance"
              type="number"
              min={1}
              value={maxAdvanceDays}
              onChange={(e) => setMaxAdvanceDays(Number(e.target.value) || 1)}
            />
          </div>
        </div>

        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        {saved && !error && <p className="text-sm text-primary">Guardado.</p>}

        <Button onClick={handleSave} disabled={saving || !slug.trim()}>
          {saving && <Loader2 className="animate-spin" />}
          {saving ? "Guardando..." : "Guardar"}
        </Button>
      </CardContent>
    </Card>
  );
}
