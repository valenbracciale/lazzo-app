import { getCurrentBusiness } from "@/lib/business";
import { createClient } from "@/lib/supabase/server";
import { getSectionSetup } from "@/lib/section-setup.server";
import { ReservationsView } from "@/components/dashboard/reservations-view";
import { BusinessTypeGate } from "@/components/dashboard/business-type-gate";
import { ReservationsSectionGate } from "@/components/dashboard/reservations-section-gate";

export default async function ReservationsPage() {
  const business = await getCurrentBusiness();
  const supabase = await createClient();

  if (!business.businessType) {
    const businessTypeSetup = await getSectionSetup(
      supabase,
      business.id,
      "business_type"
    );
    return (
      <BusinessTypeGate
        businessId={business.id}
        initialStep={businessTypeSetup.currentStep}
        initialFormData={businessTypeSetup.formData}
      />
    );
  }

  const setup = await getSectionSetup(supabase, business.id, "reservations");

  if (!setup.completed) {
    return (
      <ReservationsSectionGate
        businessId={business.id}
        businessType={business.businessType}
        initialStep={setup.currentStep}
        initialFormData={setup.formData}
      />
    );
  }

  const { data: resources } = await supabase
    .from("resources")
    .select("id, name")
    .eq("business_id", business.id)
    .order("name", { ascending: true });

  return (
    <ReservationsView businessId={business.id} resources={resources ?? []} />
  );
}
