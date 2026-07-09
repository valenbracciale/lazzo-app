"use server";

import { createAdminClient } from "@/lib/supabase/admin";

export async function confirmBusinessTypeChange(token: string): Promise<{ error?: string }> {
  const supabase = createAdminClient();

  const { error } = await supabase.rpc("confirm_business_type_change", { p_token: token });

  if (error) {
    if (error.message?.includes("invalid_or_expired_token")) {
      return { error: "Este link ya venció o ya fue usado." };
    }
    return { error: "No pudimos confirmar el cambio. Probá de nuevo." };
  }

  return {};
}
