"use client";

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { BusinessType } from "@/lib/business-types";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { ReservationsWizard } from "@/components/dashboard/reservations-wizard";

export function ReservationsSectionGate({
  businessId,
  businessType,
  initialStep,
  initialFormData,
}: {
  businessId: string;
  businessType: BusinessType;
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
          <CardTitle>Todavía no configuraste Reservas</CardTitle>
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
          <ReservationsWizard
            businessId={businessId}
            businessType={businessType}
            initialStep={initialStep}
            initialFormData={initialFormData}
            onDone={handleFinish}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
