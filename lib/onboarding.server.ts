import { createClient } from "@/lib/supabase/server";
import { getSectionSetup } from "@/lib/section-setup.server";
import type { SectionSetupState } from "@/lib/section-setup";

export type OnboardingState = {
  businessTypeSetup: SectionSetupState;
  reservationsSetup: SectionSetupState;
};

export async function getOnboardingState(
  supabase: Awaited<ReturnType<typeof createClient>>,
  businessId: string
): Promise<OnboardingState> {
  const [businessTypeSetup, reservationsSetup] = await Promise.all([
    getSectionSetup(supabase, businessId, "business_type"),
    getSectionSetup(supabase, businessId, "reservations"),
  ]);

  return { businessTypeSetup, reservationsSetup };
}
