"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { BusinessTypeWizard } from "@/components/dashboard/business-type-wizard";

export function BusinessTypeGate({
  businessId,
  initialStep,
  initialFormData,
}: {
  businessId: string;
  initialStep: number;
  initialFormData: Record<string, unknown>;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  function handleDone() {
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      <Card className="mx-auto max-w-md animate-in fade-in-0 duration-300">
        <CardHeader>
          <CardTitle>Primero configurá tu negocio</CardTitle>
          <CardDescription>
            Antes de usar esta sección necesitamos saber qué tipo de negocio
            tenés.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={() => setOpen(true)}>Configurar mi negocio</Button>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-2xl">
          <BusinessTypeWizard
            businessId={businessId}
            initialStep={initialStep}
            initialFormData={initialFormData}
            onDone={handleDone}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
