import type { createClient } from "@/lib/supabase/server";
import type { BusinessType } from "@/lib/business-types";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export type PublicBusiness = {
  id: string;
  name: string;
  businessType: BusinessType;
  minAdvanceMinutes: number;
  maxAdvanceDays: number;
};

// Never distinguishes "slug doesn't exist" from "exists but disabled" - both
// return null, so the public page 404s the same way either way and doesn't
// leak which slugs are registered.
export async function resolvePublicBusiness(
  supabase: Supabase,
  slug: string
): Promise<PublicBusiness | null> {
  const { data } = await supabase
    .from("public_booking_settings")
    .select(
      "min_advance_minutes, max_advance_days, businesses(id, name, business_type)"
    )
    .eq("slug", slug)
    .eq("enabled", true)
    .maybeSingle();

  const business = data?.businesses as unknown as
    | { id: string; name: string; business_type: BusinessType | null }
    | null;
  if (!data || !business || !business.business_type) return null;

  return {
    id: business.id,
    name: business.name,
    businessType: business.business_type,
    minAdvanceMinutes: data.min_advance_minutes,
    maxAdvanceDays: data.max_advance_days,
  };
}

export function validateBookingWindow(
  startsAtMs: number,
  settings: { minAdvanceMinutes: number; maxAdvanceDays: number }
): string | null {
  const now = Date.now();
  if (startsAtMs < now + settings.minAdvanceMinutes * 60_000) {
    return "Ese horario está demasiado cerca. Elegí uno más adelante.";
  }
  if (startsAtMs > now + settings.maxAdvanceDays * 24 * 60 * 60_000) {
    return "Ese horario está demasiado lejos. Elegí una fecha más cercana.";
  }
  return null;
}

// Server-safe date label (explicit timeZone, unlike lib/datetime.ts's
// browser-only helpers which rely on the runtime's own local timezone -
// this runs inside a Server Action, where that can't be assumed).
export function formatArgentinaDateTimeLabel(iso: string): string {
  return new Intl.DateTimeFormat("es-AR", {
    timeZone: "America/Argentina/Buenos_Aires",
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(iso));
}

export function isHoneypotTriggered(website: string | undefined | null): boolean {
  return !!website && website.trim().length > 0;
}

const COOLDOWN_MINUTES = 5;
export const PUBLIC_BOOKING_COOLDOWN_ERROR =
  "Ya registramos una reserva reciente con este teléfono. Esperá unos minutos e intentá de nuevo.";

// Cheap, zero-dependency anti-spam: caps how often the same phone number can
// book a given business, without needing a CAPTCHA provider account before
// this can ship (see plan doc - Turnstile/reCAPTCHA are an easy later
// addition, not a blocker for v1).
export async function checkPublicBookingCooldown(
  supabase: Supabase,
  businessId: string,
  phone: string
): Promise<string | null> {
  const since = new Date(Date.now() - COOLDOWN_MINUTES * 60_000).toISOString();
  const { data } = await supabase
    .from("reservations")
    .select("id")
    .eq("business_id", businessId)
    .eq("customer_phone", phone)
    .eq("source", "public")
    .gte("created_at", since)
    .limit(1)
    .maybeSingle();

  return data ? PUBLIC_BOOKING_COOLDOWN_ERROR : null;
}
