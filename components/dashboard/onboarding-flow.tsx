"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { BusinessTypeWizard } from "@/components/dashboard/business-type-wizard";
import { SectionWizardRunner } from "@/components/dashboard/section-wizard-runner";
import { getReservationsWizardSteps } from "@/components/dashboard/reservations-setup-steps";
import type { BusinessType } from "@/lib/business-types";
import type { SectionSetupState } from "@/lib/section-setup";

// Stock y Finanzas todavía no tienen wizard propio: se suman a este orden
// el día que existan, sin tocar el resto de la lógica de encadenado.
type OnboardingStep = "business_type" | "reservations";

function computePendingSteps(
  businessType: BusinessType | null,
  reservationsCompleted: boolean
): OnboardingStep[] {
  const steps: OnboardingStep[] = [];
  if (!businessType) steps.push("business_type");
  if (!reservationsCompleted) steps.push("reservations");
  return steps;
}

const OnboardingContext = createContext<{ openOnboarding: () => void } | null>(
  null
);

export function useOnboarding() {
  const ctx = useContext(OnboardingContext);
  if (!ctx) {
    throw new Error("useOnboarding must be used within OnboardingFlow");
  }
  return ctx;
}

export function OnboardingFlow({
  businessId,
  businessType: initialBusinessType,
  businessTypeSetup,
  reservationsSetup,
  isOwner,
  children,
}: {
  businessId: string;
  businessType: BusinessType | null;
  businessTypeSetup: SectionSetupState;
  reservationsSetup: SectionSetupState;
  isOwner: boolean;
  children: ReactNode;
}) {
  const router = useRouter();
  const [businessType, setBusinessType] = useState(initialBusinessType);
  const [reservationsCompleted, setReservationsCompleted] = useState(
    reservationsSetup.completed
  );
  const [pending, setPending] = useState(() =>
    isOwner ? computePendingSteps(initialBusinessType, reservationsSetup.completed) : []
  );
  const [open, setOpen] = useState(isOwner && pending.length > 0);

  function openOnboarding() {
    if (!isOwner) return;
    setPending(computePendingSteps(businessType, reservationsCompleted));
    setOpen(true);
  }

  function advance() {
    const remaining = pending.slice(1);
    setPending(remaining);
    if (remaining.length === 0) {
      setOpen(false);
      router.refresh();
    }
  }

  function handleBusinessTypeDone(chosenType: BusinessType) {
    setBusinessType(chosenType);
    advance();
  }

  function handleReservationsDone() {
    setReservationsCompleted(true);
    advance();
  }

  const current = pending[0];

  return (
    <OnboardingContext.Provider value={{ openOnboarding }}>
      {children}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-2xl">
          {current === "business_type" && (
            <BusinessTypeWizard
              businessId={businessId}
              initialStep={businessTypeSetup.currentStep}
              initialFormData={businessTypeSetup.formData}
              onDone={handleBusinessTypeDone}
            />
          )}
          {current === "reservations" && businessType && (
            <SectionWizardRunner
              businessId={businessId}
              section="reservations"
              steps={getReservationsWizardSteps(businessType)}
              initialStep={reservationsSetup.currentStep}
              initialFormData={reservationsSetup.formData}
              onFinish={handleReservationsDone}
            />
          )}
        </DialogContent>
      </Dialog>
    </OnboardingContext.Provider>
  );
}
