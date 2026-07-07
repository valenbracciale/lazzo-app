import type { ReactNode } from "react";

export type SectionKey = "business_type" | "reservations" | "stock" | "finance";

export type SectionSetupState = {
  completed: boolean;
  currentStep: number;
  formData: Record<string, unknown>;
};

export const DEFAULT_SECTION_SETUP_STATE: SectionSetupState = {
  completed: false,
  currentStep: 0,
  formData: {},
};

export type SectionWizardStepProps = {
  formData: Record<string, unknown>;
  patchFormData: (patch: Record<string, unknown>) => void;
  onNext: () => void;
  onFinish: () => void;
  isLast: boolean;
  saving: boolean;
  error: string | null;
};

export type SectionWizardStep = {
  key: string;
  render: (props: SectionWizardStepProps) => ReactNode;
};
