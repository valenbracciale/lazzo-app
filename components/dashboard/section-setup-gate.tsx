"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { SectionKey } from "@/lib/section-setup";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";

export type SectionWizardStepProps = {
  formData: Record<string, unknown>;
  patchFormData: (patch: Record<string, unknown>) => void;
  onNext: () => void;
  onFinish: () => void;
  isLast: boolean;
  saving: boolean;
  error: string | null;
};

export type SectionWizardStep = {
  key: string;
  render: (props: SectionWizardStepProps) => ReactNode;
};

export function SectionSetupGate({
  businessId,
  section,
  sectionLabel,
  steps,
  initialStep,
  initialFormData,
}: {
  businessId: string;
  section: SectionKey;
  sectionLabel: string;
  steps: SectionWizardStep[];
  initialStep: number;
  initialFormData: Record<string, unknown>;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [stepIndex, setStepIndex] = useState(
    Math.min(initialStep, steps.length - 1)
  );
  const [formData, setFormData] = useState(initialFormData);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isLast = stepIndex === steps.length - 1;

  function patchFormData(patch: Record<string, unknown>) {
    setFormData((prev) => ({ ...prev, ...patch }));
  }

  async function persist(completed: boolean, currentStep: number) {
    setSaving(true);
    setError(null);

    const supabase = createClient();
    const { error: upsertError } = await supabase
      .from("business_section_setup")
      .upsert(
        {
          business_id: businessId,
          section,
          completed,
          current_step: currentStep,
          form_data: formData,
        },
        { onConflict: "business_id,section" }
      );

    setSaving(false);
    if (upsertError) {
      setError("No pudimos guardar el progreso. Probá de nuevo.");
      return false;
    }
    return true;
  }

  async function handleNext() {
    const ok = await persist(false, stepIndex + 1);
    if (ok) setStepIndex((i) => i + 1);
  }

  async function handleFinish() {
    const ok = await persist(true, steps.length);
    if (ok) {
      setOpen(false);
      router.refresh();
    }
  }

  const currentStep = steps[stepIndex];

  return (
    <>
      <Card className="mx-auto max-w-md duration-300 animate-in fade-in-0">
        <CardHeader>
          <CardTitle>Todavía no configuraste {sectionLabel}</CardTitle>
          <CardDescription>
            Completá esta configuración para empezar a usar esta sección.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={() => setOpen(true)}>Configurar</Button>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <div
            key={stepIndex}
            className="duration-300 animate-in fade-in-0 slide-in-from-right-2"
          >
            {currentStep.render({
              formData,
              patchFormData,
              onNext: handleNext,
              onFinish: handleFinish,
              isLast,
              saving,
              error,
            })}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
