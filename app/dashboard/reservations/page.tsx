import { getCurrentBusiness } from "@/lib/business";
import { createClient } from "@/lib/supabase/server";
import { getSectionSetup } from "@/lib/section-setup.server";
import { syncNoShows } from "@/app/dashboard/reservations/actions";
import { ReservationsView } from "@/components/dashboard/reservations-view";
import { RestaurantReservationsView } from "@/components/dashboard/restaurant-reservations-view";
import { PeluqueriaReservationsView } from "@/components/dashboard/peluqueria-reservations-view";
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

  if (business.businessType === "restaurante_bar") {
    // Self-corrective no-show flagging (also runs in the background via
    // pg_cron every minute) - this catches it instantly on page load too.
    await syncNoShows(business.id);

    const [{ data: resources }, { data: shifts }, { data: settings }] = await Promise.all([
      supabase
        .from("resources")
        .select("id, name, capacity, zone_name, duration_minutes")
        .eq("business_id", business.id)
        .order("name", { ascending: true }),
      supabase
        .from("shifts")
        .select("id, name, days_of_week, start_time, end_time")
        .eq("business_id", business.id),
      supabase
        .from("reservation_settings")
        .select("capacity_mode, assignment_mode")
        .eq("business_id", business.id)
        .maybeSingle(),
    ]);

    return (
      <RestaurantReservationsView
        businessId={business.id}
        resources={resources ?? []}
        shifts={shifts ?? []}
        capacityMode={settings?.capacity_mode ?? "tables"}
        assignmentMode={settings?.assignment_mode ?? "automatic"}
      />
    );
  }

  if (business.businessType === "peluqueria_salon") {
    await syncNoShows(business.id);

    const [{ data: services }, { data: professionals }] = await Promise.all([
      supabase
        .from("services")
        .select("id, name, duration_minutes")
        .eq("business_id", business.id)
        .order("name", { ascending: true }),
      supabase
        .from("professionals")
        .select("id, name")
        .eq("business_id", business.id)
        .order("name", { ascending: true }),
    ]);

    return (
      <PeluqueriaReservationsView
        businessId={business.id}
        services={services ?? []}
        professionals={professionals ?? []}
        isOwner={business.role === "owner"}
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
