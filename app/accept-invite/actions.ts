"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function activateMembership(): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;

  if (!userId) {
    return { error: "No pudimos confirmar tu sesión. Probá de nuevo." };
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("business_members")
    .update({ status: "active", activated_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("status", "invited");

  if (error) {
    return { error: "No pudimos activar tu acceso. Probá de nuevo." };
  }

  return {};
}
