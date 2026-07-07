"use client";

import type { BusinessType } from "@/lib/business-types";
import { SectionWizardRunner } from "@/components/dashboard/section-wizard-runner";
import { getReservationsWizardSteps } from "@/components/dashboard/reservations-setup-steps";
import { RestaurantReservationsWizard } from "@/components/dashboard/restaurant-reservations-wizard";
import { PeluqueriaReservationsWizard } from "@/components/dashboard/peluqueria-reservations-wizard";

export function ReservationsWizard({
  businessId,
  businessType,
  initialStep,
  initialFormData,
  onDone,
}: {
  businessId: string;
  businessType: BusinessType | null;
  initialStep: number;
  initialFormData: Record<string, unknown>;
  onDone: () => void;
}) {
  if (businessType === "restaurante_bar") {
    return (
      <RestaurantReservationsWizard
        businessId={businessId}
        initialStep={initialStep}
        initialFormData={initialFormData}
        onDone={onDone}
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
      />
    );
  }

  return (
    <SectionWizardRunner
      businessId={businessId}
      section="reservations"
      steps={getReservationsWizardSteps(businessType)}
      initialStep={initialStep}
      initialFormData={initialFormData}
      onFinish={onDone}
    />
  );
}
