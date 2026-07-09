"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { BUSINESS_TYPES, reservationsLabel, type BusinessType } from "@/lib/business-types";
import {
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CalendarDays, Loader2, Package, Wallet } from "lucide-react";

export function BusinessTypeWizard({
  businessId,
  initialStep,
  initialFormData,
  onDone,
}: {
  businessId: string;
  initialStep: number;
  initialFormData: Record<string, unknown>;
  onDone: (businessType: BusinessType) => void;
}) {
  const [step, setStep] = useState(Math.min(initialStep, 1));
  const [businessType, setBusinessType] = useState<BusinessType | null>(
    (initialFormData.businessType as BusinessType | undefined) ?? null
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleContinue() {
    if (!businessType) return;
    setSaving(true);
    setError(null);

    const supabase = createClient();
    const { error: upsertError } = await supabase
      .from("business_section_setup")
      .upsert(
        {
          business_id: businessId,
          section: "business_type",
          completed: false,
          current_step: 1,
          form_data: { businessType },
        },
        { onConflict: "business_id,section" }
      );

    setSaving(false);
    if (upsertError) {
      setError("No pudimos guardar tu elección. Probá de nuevo.");
      return;
    }
    setStep(1);
  }

  async function handleConfirm() {
    if (!businessType) return;
    setSaving(true);
    setError(null);

    const supabase = createClient();
    const { error: updateError } = await supabase
      .from("businesses")
      .update({ business_type: businessType })
      .eq("id", businessId);

    if (updateError) {
      setSaving(false);
      setError("No pudimos guardar el tipo de negocio. Probá de nuevo.");
      return;
    }

    const { error: setupError } = await supabase
      .from("business_section_setup")
      .upsert(
        {
          business_id: businessId,
          section: "business_type",
          completed: true,
          current_step: 2,
          form_data: { businessType },
        },
        { onConflict: "business_id,section" }
      );

    setSaving(false);
    if (setupError) {
      setError("No pudimos guardar el tipo de negocio. Probá de nuevo.");
      return;
    }

    onDone(businessType);
  }

  const selectedLabel = BUSINESS_TYPES.find((t) => t.value === businessType)?.label;

  return (
    <div key={step} className="duration-300 animate-in fade-in-0 slide-in-from-right-2">
      {step === 0 ? (
        <>
          <DialogHeader>
            <DialogTitle>¿Qué tipo de negocio tenés?</DialogTitle>
            <DialogDescription>
              Elegí la opción que mejor describe tu negocio. Esto nos permite
              adaptar Lazzo completamente a tu forma de trabajar.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3 py-4 sm:grid-cols-3">
            {BUSINESS_TYPES.map((type) => (
              <button
                key={type.value}
                type="button"
                onClick={() => setBusinessType(type.value)}
                className={cn(
                  "rounded-lg border p-4 text-left transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-md hover:shadow-primary/20",
                  businessType === type.value
                    ? "border-primary bg-primary/5 ring-1 ring-primary"
                    : "border-border hover:bg-muted"
                )}
              >
                <p className="font-semibold">{type.label}</p>
                <ul className="mt-2 space-y-1.5 text-xs text-muted-foreground">
                  <li className="flex items-start gap-1.5">
                    <CalendarDays className="mt-0.5 size-3 shrink-0" />
                    <span>{type.summary.reservations}</span>
                  </li>
                  <li className="flex items-start gap-1.5">
                    <Package className="mt-0.5 size-3 shrink-0" />
                    <span>{type.summary.stock}</span>
                  </li>
                  <li className="flex items-start gap-1.5">
                    <Wallet className="mt-0.5 size-3 shrink-0" />
                    <span>{type.summary.finance}</span>
                  </li>
                </ul>
              </button>
            ))}
          </div>

          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}

          <DialogFooter>
            <Button
              onClick={handleContinue}
              disabled={!businessType || saving}
            >
              {saving && <Loader2 className="animate-spin" />}
              {saving ? "Guardando..." : "Continuar"}
            </Button>
          </DialogFooter>
        </>
      ) : (
        <>
          <DialogHeader>
            <DialogTitle>Confirmá tu elección</DialogTitle>
            <DialogDescription>Elegiste: {selectedLabel}</DialogDescription>
          </DialogHeader>

          <p className="py-4 text-sm text-muted-foreground">
            Esta elección determina cómo funciona todo Lazzo para este
            negocio ({reservationsLabel(businessType)}, Stock y Finanzas).
            Cambiarla más adelante no es trivial, así que asegurate de que
            sea la correcta antes de confirmar.
          </p>

          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setStep(0)}
              disabled={saving}
            >
              Volver
            </Button>
            <Button onClick={handleConfirm} disabled={saving}>
              {saving && <Loader2 className="animate-spin" />}
              {saving ? "Guardando..." : "Confirmar"}
            </Button>
          </DialogFooter>
        </>
      )}
    </div>
  );
}
