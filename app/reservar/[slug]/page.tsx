import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolvePublicBusiness } from "@/lib/reservations/public-booking.server";
import { PublicRestaurantBooking } from "@/components/public-booking/restaurant-booking";
import { PublicPeluqueriaBooking } from "@/components/public-booking/peluqueria-booking";
import { PublicGimnasioBooking } from "@/components/public-booking/gimnasio-booking";

export default async function PublicBookingPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = createAdminClient();
  const business = await resolvePublicBusiness(supabase, slug);
  if (!business) notFound();

  if (business.businessType === "restaurante_bar") {
    const [{ data: settings }, { data: resources }] = await Promise.all([
      supabase
        .from("reservation_settings")
        .select("capacity_mode, assignment_mode, max_party_size")
        .eq("business_id", business.id)
        .maybeSingle(),
      supabase
        .from("resources")
        .select("zone_name")
        .eq("business_id", business.id)
        .not("zone_name", "is", null),
    ]);

    const zoneNames = Array.from(
      new Set((resources ?? []).map((r) => r.zone_name).filter((z): z is string => !!z))
    );

    return (
      <PublicRestaurantBooking
        slug={slug}
        businessName={business.name}
        logoUrl={business.logoUrl}
        capacityMode={(settings?.capacity_mode ?? "tables") as "tables" | "zones"}
        assignmentMode={(settings?.assignment_mode ?? "automatic") as "automatic" | "manual"}
        maxPartySize={settings?.max_party_size ?? 20}
        zoneNames={zoneNames}
      />
    );
  }

  if (business.businessType === "peluqueria_salon") {
    const { data: services } = await supabase
      .from("services")
      .select("id, name, duration_minutes")
      .eq("business_id", business.id)
      .order("name", { ascending: true });

    return (
      <PublicPeluqueriaBooking
        slug={slug}
        businessName={business.name}
        logoUrl={business.logoUrl}
        services={services ?? []}
      />
    );
  }

  if (business.businessType === "gimnasio_academia") {
    return <PublicGimnasioBooking slug={slug} businessName={business.name} logoUrl={business.logoUrl} />;
  }

  notFound();
}
