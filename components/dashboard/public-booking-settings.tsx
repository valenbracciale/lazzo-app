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
import { Loader2, Trash2, Upload } from "lucide-react";
import { slugify } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { updateBusinessLogo, updatePublicBookingSettings } from "@/app/dashboard/settings/actions";

const LOGO_BUCKET = "business-logos";
const MAX_LOGO_BYTES = 2 * 1024 * 1024;
const ALLOWED_LOGO_TYPES: Record<string, string> = {
  "image/png": "png",
  "image/svg+xml": "svg",
};

function logoStoragePathFromUrl(url: string): string | null {
  const marker = `/${LOGO_BUCKET}/`;
  const index = url.indexOf(marker);
  if (index === -1) return null;
  return url.slice(index + marker.length).split("?")[0];
}

export function PublicBookingSettings({
  businessId,
  businessName,
  origin,
  initialSlug,
  initialEnabled,
  initialMinAdvanceMinutes,
  initialMaxAdvanceDays,
  initialLogoUrl,
}: {
  businessId: string;
  businessName: string;
  origin: string;
  initialSlug: string;
  initialEnabled: boolean;
  initialMinAdvanceMinutes: number;
  initialMaxAdvanceDays: number;
  initialLogoUrl: string | null;
}) {
  const [slug, setSlug] = useState(initialSlug || slugify(businessName));
  const [enabled, setEnabled] = useState(initialEnabled);
  const [minAdvanceMinutes, setMinAdvanceMinutes] = useState(initialMinAdvanceMinutes);
  const [maxAdvanceDays, setMaxAdvanceDays] = useState(initialMaxAdvanceDays);
  const [logoUrl, setLogoUrl] = useState(initialLogoUrl);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [logoError, setLogoError] = useState<string | null>(null);

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

  async function handleLogoChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setLogoError(null);
    const ext = ALLOWED_LOGO_TYPES[file.type];
    if (!ext) {
      setLogoError("El logo tiene que ser un archivo PNG o SVG.");
      return;
    }
    if (file.size > MAX_LOGO_BYTES) {
      setLogoError("El logo no puede pesar más de 2 MB.");
      return;
    }

    setUploadingLogo(true);
    const supabase = createClient();
    const path = `${businessId}/logo.${ext}`;
    const { error: uploadError } = await supabase.storage
      .from(LOGO_BUCKET)
      .upload(path, file, { upsert: true, contentType: file.type });

    if (uploadError) {
      setUploadingLogo(false);
      setLogoError("No pudimos subir el logo. Probá de nuevo.");
      return;
    }

    const { data } = supabase.storage.from(LOGO_BUCKET).getPublicUrl(path);
    // Cache-bust so re-uploading the same filename shows the new image right
    // away instead of a stale cached copy at the same URL.
    const bustedUrl = `${data.publicUrl}?v=${Date.now()}`;

    const result = await updateBusinessLogo({ logoUrl: bustedUrl });
    setUploadingLogo(false);
    if (result.error) {
      setLogoError(result.error);
      return;
    }
    setLogoUrl(bustedUrl);
  }

  async function handleRemoveLogo() {
    setUploadingLogo(true);
    setLogoError(null);

    if (logoUrl) {
      const path = logoStoragePathFromUrl(logoUrl);
      if (path) {
        const supabase = createClient();
        await supabase.storage.from(LOGO_BUCKET).remove([path]);
      }
    }

    const result = await updateBusinessLogo({ logoUrl: null });
    setUploadingLogo(false);
    if (result.error) {
      setLogoError(result.error);
      return;
    }
    setLogoUrl(null);
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

        <div className="space-y-1.5">
          <Label htmlFor="business_logo">Logo del negocio</Label>
          <div className="flex items-center gap-3">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logoUrl}
                alt="Logo del negocio"
                className="size-14 rounded-md border border-border object-contain bg-background p-1"
              />
            ) : (
              <div className="flex size-14 items-center justify-center rounded-md border border-dashed border-border text-xs text-muted-foreground">
                Sin logo
              </div>
            )}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-2">
                <Button type="button" variant="outline" size="sm" disabled={uploadingLogo} asChild>
                  <label htmlFor="business_logo" className="cursor-pointer">
                    {uploadingLogo ? <Loader2 className="animate-spin" /> : <Upload />}
                    {logoUrl ? "Cambiar logo" : "Subir logo"}
                  </label>
                </Button>
                {logoUrl && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={uploadingLogo}
                    onClick={handleRemoveLogo}
                  >
                    <Trash2 /> Quitar
                  </Button>
                )}
              </div>
              <input
                id="business_logo"
                type="file"
                accept=".png,.svg,image/png,image/svg+xml"
                onChange={handleLogoChange}
                disabled={uploadingLogo}
                className="hidden"
              />
              <p className="text-xs text-muted-foreground">
                PNG con fondo transparente o SVG, hasta 2 MB. Se muestra en tu página de reserva pública.
              </p>
            </div>
          </div>
          {logoError && (
            <p role="alert" className="text-sm text-destructive">
              {logoError}
            </p>
          )}
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
