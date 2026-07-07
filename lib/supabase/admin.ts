import { createClient } from "@supabase/supabase-js";

// Bypasses Row Level Security entirely - never import this from client code
// or use it for anything the caller's own session/role hasn't already been
// verified to be authorized for.
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
