"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { SectionKey, SectionWizardStep } from "@/lib/section-setup";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { SectionWizardRunner } from "@/components/dashboard/section-wizard-runner";

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

  function handleFinish() {
    setOpen(false);
    router.refresh();
  }

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
          <SectionWizardRunner
            businessId={businessId}
            section={section}
            steps={steps}
            initialStep={initialStep}
            initialFormData={initialFormData}
            onFinish={handleFinish}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
