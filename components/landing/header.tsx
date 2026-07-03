import { createClient } from "@/lib/supabase/server";
import { HeaderClient } from "./header-client";

export async function Header() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const email = (data?.claims?.email as string | undefined) ?? null;

  return <HeaderClient email={email} />;
}
