import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { BusinessType } from "@/lib/business-types";

export type BusinessRole = "owner" | "encargado";

export type CurrentBusiness = {
  id: string;
  name: string;
  email: string;
  businessType: BusinessType | null;
  role: BusinessRole;
};

export async function getCurrentBusiness(): Promise<CurrentBusiness> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  const email = data?.claims?.email as string | undefined;

  if (!userId || !email) {
    redirect("/login");
  }

  const { data: ownedBusiness } = await supabase
    .from("businesses")
    .select("id, name, business_type")
    .eq("owner_id", userId)
    .limit(1)
    .maybeSingle();

  if (ownedBusiness) {
    return {
      id: ownedBusiness.id,
      name: ownedBusiness.name,
      businessType: ownedBusiness.business_type as BusinessType | null,
      email,
      role: "owner",
    };
  }

  const { data: membership } = await supabase
    .from("business_members")
    .select("business_id, status")
    .eq("user_id", userId)
    .maybeSingle();

  if (!membership) {
    redirect("/login");
  }

  if (membership.status === "revoked") {
    redirect("/login?error=access-revoked");
  }

  if (membership.status === "invited") {
    redirect("/login?error=invite-incomplete");
  }

  const { data: memberBusiness } = await supabase
    .from("businesses")
    .select("id, name, business_type")
    .eq("id", membership.business_id)
    .maybeSingle();

  if (!memberBusiness) {
    redirect("/login");
  }

  return {
    id: memberBusiness.id,
    name: memberBusiness.name,
    businessType: memberBusiness.business_type as BusinessType | null,
    email,
    role: "encargado",
  };
}
