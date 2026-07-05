"use client";

import type { BusinessType } from "@/lib/business-types";
import { SectionSetupGate } from "@/components/dashboard/section-setup-gate";
import { getReservationsWizardSteps } from "@/components/dashboard/reservations-setup-steps";

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
  return (
    <SectionSetupGate
      businessId={businessId}
      section="reservations"
      sectionLabel="Reservas"
      steps={getReservationsWizardSteps(businessType)}
      initialStep={initialStep}
      initialFormData={initialFormData}
    />
  );
}
