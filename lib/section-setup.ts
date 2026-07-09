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
