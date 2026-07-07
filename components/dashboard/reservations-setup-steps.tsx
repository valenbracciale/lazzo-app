import type { BusinessType } from "@/lib/business-types";
import type { SectionWizardStep } from "@/lib/section-setup";
import {
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

const COPY_BY_TYPE: Record<BusinessType, string> = {
  restaurante_bar: "sobre tus mesas y turnos",
  peluqueria_salon: "sobre tus servicios y profesionales",
  gimnasio_academia: "sobre tus clases y cupos",
};

export function getReservationsWizardSteps(
  businessType: BusinessType | null
): SectionWizardStep[] {
  const detail = businessType
    ? COPY_BY_TYPE[businessType]
    : "sobre los detalles de tu operación";

  return [
    {
      key: "confirm",
      render: ({ onFinish, saving, error }) => (
        <>
          <DialogHeader>
            <DialogTitle>Confirmar configuración de Reservas</DialogTitle>
            <DialogDescription>
              En una próxima etapa te vamos a preguntar {detail}. Por ahora,
              confirmá para activar el módulo de Reservas.
            </DialogDescription>
          </DialogHeader>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button onClick={onFinish} disabled={saving}>
              {saving && <Loader2 className="animate-spin" />}
              {saving ? "Guardando..." : "Confirmar configuración"}
            </Button>
          </DialogFooter>
        </>
      ),
    },
  ];
}
