import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { BusinessType } from "@/lib/business-types";

export type CurrentBusiness = {
  id: string;
  name: string;
  ownerEmail: string;
  businessType: BusinessType | null;
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
    .select("id, name, business_type")
    .eq("owner_id", userId)
    .limit(1)
    .maybeSingle();

  if (!business) {
    redirect("/login");
  }

  return {
    id: business.id,
    name: business.name,
    businessType: business.business_type as BusinessType | null,
    ownerEmail: email,
  };
}
