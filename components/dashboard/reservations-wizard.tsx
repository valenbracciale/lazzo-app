"use client";

import type { BusinessType } from "@/lib/business-types";
import { RestaurantReservationsWizard } from "@/components/dashboard/restaurant-reservations-wizard";
import { PeluqueriaReservationsWizard } from "@/components/dashboard/peluqueria-reservations-wizard";
import { GimnasioReservationsWizard } from "@/components/dashboard/gimnasio-reservations-wizard";

export function ReservationsWizard({
  businessId,
  businessType,
  initialStep,
  initialFormData,
  onDone,
  isEditingCompleted = false,
}: {
  businessId: string;
  businessType: BusinessType | null;
  initialStep: number;
  initialFormData: Record<string, unknown>;
  onDone: () => void;
  // True when opened from the post-setup edit panel (section already
  // completed) rather than the first-time setup gate. Intermediate step
  // progress must not be persisted in that case - see each wizard's
  // persistAndAdvance for why.
  isEditingCompleted?: boolean;
}) {
  if (businessType === "restaurante_bar") {
    return (
      <RestaurantReservationsWizard
        businessId={businessId}
        initialStep={initialStep}
        initialFormData={initialFormData}
        onDone={onDone}
        isEditingCompleted={isEditingCompleted}
      />
    );
  }

  if (businessType === "peluqueria_salon") {
    return (
      <PeluqueriaReservationsWizard
        businessId={businessId}
        initialStep={initialStep}
        initialFormData={initialFormData}
        onDone={onDone}
        isEditingCompleted={isEditingCompleted}
      />
    );
  }

  if (businessType === "gimnasio_academia") {
    return (
      <GimnasioReservationsWizard
        businessId={businessId}
        initialStep={initialStep}
        initialFormData={initialFormData}
        onDone={onDone}
        isEditingCompleted={isEditingCompleted}
      />
    );
  }

  // Every real business type has a bespoke wizard above. Reaching this means
  // businessType is null or unrecognized - never silently mark the section
  // configured without collecting real data.
  return (
    <p className="text-sm text-destructive">
      No pudimos determinar el tipo de negocio para configurar esta sección.
      Volvé a intentarlo o contactá a soporte.
    </p>
  );
}
