"use server";

import { createAdminClient } from "@/lib/supabase/admin";

export async function confirmWaitlistSeat(token: string): Promise<{ error?: string }> {
  const supabase = createAdminClient();

  const { error } = await supabase.rpc("confirm_waitlist_seat", { p_token: token });

  if (error) {
    if (error.message?.includes("invalid_or_expired_token")) {
      return { error: "Este link ya venció o ya fue usado." };
    }
    if (error.message?.includes("class_full")) {
      return { error: "Este lugar ya fue ocupado por otro alumno en espera." };
    }
    return { error: "No pudimos confirmar tu lugar. Probá de nuevo." };
  }

  return {};
}
