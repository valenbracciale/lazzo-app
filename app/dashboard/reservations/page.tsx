import { headers } from "next/headers";
import { getCurrentBusiness } from "@/lib/business";
import { createClient } from "@/lib/supabase/server";
import { getSectionSetup } from "@/lib/section-setup.server";
import { reservationsLabel } from "@/lib/business-types";
import { syncNoShows } from "@/app/dashboard/reservations/actions";
import { ReservationsView } from "@/components/dashboard/reservations-view";
import { RestaurantReservationsView } from "@/components/dashboard/restaurant-reservations-view";
import { PeluqueriaReservationsView } from "@/components/dashboard/peluqueria-reservations-view";
import { GimnasioReservationsView } from "@/components/dashboard/gimnasio-reservations-view";
import { PublicBookingLinkButton } from "@/components/dashboard/public-booking-link-button";
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
      return <SectionPendingNotice sectionLabel={reservationsLabel(business.businessType)} />;
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

  let publicBookingButton: React.ReactNode = null;
  if (business.role === "owner") {
    const headersList = await headers();
    const host = headersList.get("host");
    const protocol = host?.startsWith("localhost") ? "http" : "https";
    const origin = `${protocol}://${host}`;

    const [{ data: publicBookingSettings }, { data: businessRow }] = await Promise.all([
      supabase
        .from("public_booking_settings")
        .select("slug, enabled, min_advance_minutes, max_advance_days")
        .eq("business_id", business.id)
        .maybeSingle(),
      supabase.from("businesses").select("logo_url").eq("id", business.id).maybeSingle(),
    ]);

    publicBookingButton = (
      <PublicBookingLinkButton
        businessId={business.id}
        businessName={business.name}
        origin={origin}
        initialSlug={publicBookingSettings?.slug ?? ""}
        initialEnabled={publicBookingSettings?.enabled ?? false}
        initialMinAdvanceMinutes={publicBookingSettings?.min_advance_minutes ?? 60}
        initialMaxAdvanceDays={publicBookingSettings?.max_advance_days ?? 30}
        initialLogoUrl={businessRow?.logo_url ?? null}
      />
    );
  }

  if (business.businessType === "restaurante_bar") {
    // Self-corrective no-show flagging (also runs in the background via
    // pg_cron every minute) - this catches it instantly on page load too.
    // Runs concurrently with the page's own data fetch since neither depends
    // on the other's result.
    const [, { data: resources }, { data: shifts }, { data: settings }] = await Promise.all([
      syncNoShows(business.id),
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
        .select("capacity_mode, assignment_mode, max_party_size")
        .eq("business_id", business.id)
        .maybeSingle(),
    ]);

    return (
      <div className="space-y-4">
        {publicBookingButton && <div className="flex justify-end">{publicBookingButton}</div>}
        <RestaurantReservationsView
          businessId={business.id}
          resources={resources ?? []}
          shifts={shifts ?? []}
          capacityMode={settings?.capacity_mode ?? "tables"}
          assignmentMode={settings?.assignment_mode ?? "automatic"}
          maxPartySize={settings?.max_party_size ?? 20}
        />
      </div>
    );
  }

  if (business.businessType === "peluqueria_salon") {
    const [, { data: services }, { data: professionals }] = await Promise.all([
      syncNoShows(business.id),
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
      <div className="space-y-4">
        {publicBookingButton && <div className="flex justify-end">{publicBookingButton}</div>}
        <PeluqueriaReservationsView
          businessId={business.id}
          services={services ?? []}
          professionals={professionals ?? []}
          isOwner={business.role === "owner"}
        />
      </div>
    );
  }

  if (business.businessType === "gimnasio_academia") {
    async function fetchOwnInstructorId(): Promise<string | null> {
      if (business.role !== "encargado") return null;
      const { data: claims } = await supabase.auth.getClaims();
      const userId = claims?.claims?.sub;
      const { data: membership } = await supabase
        .from("business_members")
        .select("professional_id")
        .eq("business_id", business.id)
        .eq("user_id", userId)
        .maybeSingle();
      return membership?.professional_id ?? null;
    }

    const [, ownInstructorId] = await Promise.all([
      syncNoShows(business.id),
      fetchOwnInstructorId(),
    ]);

    return (
      <div className="space-y-4">
        {publicBookingButton && <div className="flex justify-end">{publicBookingButton}</div>}
        <GimnasioReservationsView
          businessId={business.id}
          isOwner={business.role === "owner"}
          ownInstructorId={ownInstructorId}
        />
      </div>
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
