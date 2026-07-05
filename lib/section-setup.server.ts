import { createClient } from "@/lib/supabase/server";
import {
  DEFAULT_SECTION_SETUP_STATE,
  type SectionKey,
  type SectionSetupState,
} from "@/lib/section-setup";

export async function getSectionSetup(
  supabase: Awaited<ReturnType<typeof createClient>>,
  businessId: string,
  section: SectionKey
): Promise<SectionSetupState> {
  const { data } = await supabase
    .from("business_section_setup")
    .select("completed, current_step, form_data")
    .eq("business_id", businessId)
    .eq("section", section)
    .maybeSingle();

  if (!data) {
    return DEFAULT_SECTION_SETUP_STATE;
  }

  return {
    completed: data.completed,
    currentStep: data.current_step,
    formData: (data.form_data as Record<string, unknown>) ?? {},
  };
}
