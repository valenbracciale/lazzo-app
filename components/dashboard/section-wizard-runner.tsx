"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { SectionKey, SectionWizardStep } from "@/lib/section-setup";

export function SectionWizardRunner({
  businessId,
  section,
  steps,
  initialStep,
  initialFormData,
  onFinish,
}: {
  businessId: string;
  section: SectionKey;
  steps: SectionWizardStep[];
  initialStep: number;
  initialFormData: Record<string, unknown>;
  onFinish: () => void;
}) {
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
    if (ok) onFinish();
  }

  const currentStep = steps[stepIndex];

  return (
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
  );
}
