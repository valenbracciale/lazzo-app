import { getCurrentBusiness } from "@/lib/business";
import { createClient } from "@/lib/supabase/server";
import { getSectionSetup } from "@/lib/section-setup.server";
import { ReservationsView } from "@/components/dashboard/reservations-view";
import { BusinessTypeGate } from "@/components/dashboard/business-type-gate";
import { ReservationsSectionGate } from "@/components/dashboard/reservations-section-gate";
import { SectionPendingNotice } from "@/components/dashboard/section-pending-notice";

export default async function ReservationsPage() {
  const business = await getCurrentBusiness();
  const supabase = await createClient();

  if (!business.businessType) {
    if (business.role !== "owner") {
      return <SectionPendingNotice sectionLabel="Reservas" />;
    }
    return <BusinessTypeGate />;
  }

  const setup = await getSectionSetup(supabase, business.id, "reservations");

  if (!setup.completed) {
    if (business.role !== "owner") {
      return <SectionPendingNotice sectionLabel="Reservas" />;
    }
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
