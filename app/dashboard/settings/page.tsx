import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getCurrentBusiness } from "@/lib/business";
import { createClient } from "@/lib/supabase/server";
import { signState } from "@/lib/mercadopago/state.server";
import { getSectionSetup } from "@/lib/section-setup.server";
import {
  getRestaurantConfigSnapshot,
  getPeluqueriaConfigSnapshot,
  getGimnasioConfigSnapshot,
} from "@/lib/reservations/config-snapshot.server";
import { SettingsView } from "@/components/dashboard/settings-view";
import { TeamSettings } from "@/components/dashboard/team-settings";
import { MercadoPagoSettings } from "@/components/dashboard/mercadopago-settings";
import { ReservationsEditPanel } from "@/components/dashboard/reservations-edit-panel";
import { BusinessTypeDangerZone } from "@/components/dashboard/business-type-danger-zone";
import { PublicBookingSettings } from "@/components/dashboard/public-booking-settings";
import { reservationsLabel } from "@/lib/business-types";

export default async function SettingsPage() {
  const business = await getCurrentBusiness();

  if (business.role !== "owner") {
    redirect("/dashboard/reservations");
  }

  const supabase = await createClient();
  const wantsProfessionals =
    business.businessType === "peluqueria_salon" || business.businessType === "gimnasio_academia";
  const wantsMercadoPago = business.businessType === "gimnasio_academia";

  const [
    { data: members },
    { data: professionalsData },
    { data: mpConnection },
    setup,
    { data: publicBookingSettings },
    { data: businessRow },
  ] = await Promise.all([
    supabase
      .from("business_members")
      .select("id, name, email, status, professional_id")
      .eq("business_id", business.id)
      .order("invited_at", { ascending: true }),
    wantsProfessionals
      ? supabase
          .from("professionals")
          .select("id, name")
          .eq("business_id", business.id)
          .order("name", { ascending: true })
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
    wantsMercadoPago
      ? supabase
          .from("mercadopago_connections")
          .select("business_id")
          .eq("business_id", business.id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    business.businessType
      ? getSectionSetup(supabase, business.id, "reservations")
      : Promise.resolve(null),
    business.businessType
      ? supabase
          .from("public_booking_settings")
          .select("slug, enabled, min_advance_minutes, max_advance_days")
          .eq("business_id", business.id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    supabase.from("businesses").select("logo_url").eq("id", business.id).maybeSingle(),
  ]);

  const professionals = professionalsData ?? [];
  const professionalLabel = business.businessType === "gimnasio_academia" ? "profesor" : "profesional";

  const headersList = await headers();
  const host = headersList.get("host");
  const protocol = host?.startsWith("localhost") ? "http" : "https";
  const origin = `${protocol}://${host}`;

  let mercadoPago: { connected: boolean; authUrl: string } | null = null;
  if (wantsMercadoPago) {
    const redirectUri = `${origin}/api/mercadopago/oauth/callback`;
    const authUrl =
      `https://auth.mercadopago.com/authorization?client_id=${process.env.MERCADOPAGO_CLIENT_ID}` +
      `&response_type=code&platform_id=mp&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&state=${signState(business.id)}`;

    mercadoPago = { connected: !!mpConnection, authUrl };
  }

  let reservationsConfig: Record<string, unknown> | null = null;
  if (business.businessType && setup?.completed) {
    if (business.businessType === "restaurante_bar") {
      reservationsConfig = await getRestaurantConfigSnapshot(supabase, business.id);
    } else if (business.businessType === "peluqueria_salon") {
      reservationsConfig = await getPeluqueriaConfigSnapshot(supabase, business.id);
    } else if (business.businessType === "gimnasio_academia") {
      reservationsConfig = await getGimnasioConfigSnapshot(supabase, business.id);
    }
  }

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <SettingsView businessId={business.id} businessName={business.name} />
      {reservationsConfig && business.businessType && (
        <ReservationsEditPanel
          businessId={business.id}
          businessType={business.businessType}
          sectionLabel={reservationsLabel(business.businessType)}
          currentConfig={reservationsConfig}
        />
      )}
      <TeamSettings
        members={members ?? []}
        professionals={professionals}
        professionalLabel={professionalLabel}
        sectionLabel={reservationsLabel(business.businessType)}
      />
      {mercadoPago && (
        <MercadoPagoSettings connected={mercadoPago.connected} authUrl={mercadoPago.authUrl} />
      )}
      {business.businessType && (
        <PublicBookingSettings
          businessId={business.id}
          businessName={business.name}
          origin={origin}
          initialSlug={publicBookingSettings?.slug ?? ""}
          initialEnabled={publicBookingSettings?.enabled ?? false}
          initialMinAdvanceMinutes={publicBookingSettings?.min_advance_minutes ?? 60}
          initialMaxAdvanceDays={publicBookingSettings?.max_advance_days ?? 30}
          initialLogoUrl={businessRow?.logo_url ?? null}
        />
      )}
      {business.businessType && <BusinessTypeDangerZone />}
    </div>
  );
}
