import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type CurrentBusiness = {
  id: string;
  name: string;
  ownerEmail: string;
};

export async function getCurrentBusiness(): Promise<CurrentBusiness> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  const email = data?.claims?.email as string | undefined;

  if (!userId || !email) {
    redirect("/login");
  }

  const { data: business } = await supabase
    .from("businesses")
    .select("id, name")
    .eq("owner_id", userId)
    .limit(1)
    .maybeSingle();

  if (!business) {
    redirect("/login");
  }

  return { ...business, ownerEmail: email };
}
