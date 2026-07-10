"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { BusinessType } from "@/lib/business-types";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { ReservationsWizard } from "@/components/dashboard/reservations-wizard";
import { Pencil } from "lucide-react";

export function ReservationsEditPanel({
  businessId,
  businessType,
  sectionLabel,
  currentConfig,
}: {
  businessId: string;
  businessType: BusinessType;
  sectionLabel: string;
  currentConfig: Record<string, unknown>;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  function handleFinish() {
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>{sectionLabel}</CardTitle>
          <CardDescription>
            Editá horarios, capacidad y profesionales cuando lo necesites.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" onClick={() => setOpen(true)}>
            <Pencil /> Editar configuración
          </Button>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <ReservationsWizard
            businessId={businessId}
            businessType={businessType}
            initialStep={0}
            initialFormData={currentConfig}
            onDone={handleFinish}
            isEditingCompleted
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
