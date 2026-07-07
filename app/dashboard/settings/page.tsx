import { redirect } from "next/navigation";
import { getCurrentBusiness } from "@/lib/business";
import { createClient } from "@/lib/supabase/server";
import { SettingsView } from "@/components/dashboard/settings-view";
import { TeamSettings } from "@/components/dashboard/team-settings";

export default async function SettingsPage() {
  const business = await getCurrentBusiness();

  if (business.role !== "owner") {
    redirect("/dashboard/reservations");
  }

  const supabase = await createClient();
  const { data: members } = await supabase
    .from("business_members")
    .select("id, name, email, status, professional_id")
    .eq("business_id", business.id)
    .order("invited_at", { ascending: true });

  let professionals: { id: string; name: string }[] = [];
  if (business.businessType === "peluqueria_salon") {
    const { data } = await supabase
      .from("professionals")
      .select("id, name")
      .eq("business_id", business.id)
      .order("name", { ascending: true });
    professionals = data ?? [];
  }

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <SettingsView businessId={business.id} businessName={business.name} />
      <TeamSettings members={members ?? []} professionals={professionals} />
    </div>
  );
}
