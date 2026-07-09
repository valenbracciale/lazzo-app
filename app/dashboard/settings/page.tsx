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
import { reservationsLabel } from "@/lib/business-types";

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
  if (business.businessType === "peluqueria_salon" || business.businessType === "gimnasio_academia") {
    const { data } = await supabase
      .from("professionals")
      .select("id, name")
      .eq("business_id", business.id)
      .order("name", { ascending: true });
    professionals = data ?? [];
  }

  const professionalLabel = business.businessType === "gimnasio_academia" ? "profesor" : "profesional";

  let mercadoPago: { connected: boolean; authUrl: string } | null = null;
  if (business.businessType === "gimnasio_academia") {
    const { data: connection } = await supabase
      .from("mercadopago_connections")
      .select("business_id")
      .eq("business_id", business.id)
      .maybeSingle();

    const headersList = await headers();
    const host = headersList.get("host");
    const protocol = host?.startsWith("localhost") ? "http" : "https";
    const redirectUri = `${protocol}://${host}/api/mercadopago/oauth/callback`;
    const authUrl =
      `https://auth.mercadopago.com/authorization?client_id=${process.env.MERCADOPAGO_CLIENT_ID}` +
      `&response_type=code&platform_id=mp&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&state=${signState(business.id)}`;

    mercadoPago = { connected: !!connection, authUrl };
  }

  let reservationsConfig: Record<string, unknown> | null = null;
  if (business.businessType) {
    const setup = await getSectionSetup(supabase, business.id, "reservations");
    if (setup.completed) {
      if (business.businessType === "restaurante_bar") {
        reservationsConfig = await getRestaurantConfigSnapshot(supabase, business.id);
      } else if (business.businessType === "peluqueria_salon") {
        reservationsConfig = await getPeluqueriaConfigSnapshot(supabase, business.id);
      } else if (business.businessType === "gimnasio_academia") {
        reservationsConfig = await getGimnasioConfigSnapshot(supabase, business.id);
      }
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
      {business.businessType && <BusinessTypeDangerZone />}
    </div>
  );
}
