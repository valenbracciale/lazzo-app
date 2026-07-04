import { getCurrentBusiness } from "@/lib/business";
import { createClient } from "@/lib/supabase/server";
import { ReservationsView } from "@/components/dashboard/reservations-view";

export default async function ReservationsPage() {
  const business = await getCurrentBusiness();

  const supabase = await createClient();
  const { data: resources } = await supabase
    .from("resources")
    .select("id, name")
    .eq("business_id", business.id)
    .order("name", { ascending: true });

  return (
    <ReservationsView businessId={business.id} resources={resources ?? []} />
  );
}
