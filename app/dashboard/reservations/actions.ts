"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentBusiness } from "@/lib/business";
import {
  getAvailableSlots,
  listFreeResourcesAt,
  localSlotToUtcIso,
  type SlotAvailability,
} from "@/lib/reservations/availability.server";

type CreateRestaurantReservationInput = {
  customerName: string;
  customerPhone: string;
  customerEmail: string | null;
  notes: string | null;
  localDate: string;
  time: string;
  partySize: number;
  zonePreference: string | null;
  resourceId?: string | null;
};

const NO_SLOT_ERROR = "Ese horario ya no tiene lugar disponible. Elegí otro horario.";

export async function fetchAvailableSlots(input: {
  localDate: string;
  partySize: number;
  zonePreference: string | null;
  excludeReservationId?: string | null;
}): Promise<SlotAvailability[]> {
  const business = await getCurrentBusiness();
  const supabase = await createClient();

  return getAvailableSlots({
    supabase,
    businessId: business.id,
    localDate: input.localDate,
    partySize: input.partySize,
    zonePreference: input.zonePreference,
    excludeReservationId: input.excludeReservationId,
  });
}

export async function fetchFreeResources(input: {
  localDate: string;
  time: string;
  partySize: number;
  zonePreference: string | null;
  excludeReservationId?: string | null;
}): Promise<{ id: string; name: string; capacity: number; zone_name: string | null }[]> {
  const business = await getCurrentBusiness();
  const supabase = await createClient();
  const startsAt = localSlotToUtcIso(input.localDate, input.time);

  const resources = await listFreeResourcesAt({
    supabase,
    businessId: business.id,
    startsAt,
    partySize: input.partySize,
    zonePreference: input.zonePreference,
    excludeReservationId: input.excludeReservationId,
  });

  return resources.map((r) => ({
    id: r.id,
    name: r.name,
    capacity: r.capacity,
    zone_name: r.zone_name,
  }));
}

export async function createRestaurantReservation(
  input: CreateRestaurantReservationInput
): Promise<{ error?: string }> {
  const business = await getCurrentBusiness();
  const supabase = await createClient();
  const startsAt = localSlotToUtcIso(input.localDate, input.time);

  const { data: settings } = await supabase
    .from("reservation_settings")
    .select("assignment_mode")
    .eq("business_id", business.id)
    .maybeSingle();

  const assignmentMode = settings?.assignment_mode ?? "automatic";

  const freeResources = await listFreeResourcesAt({
    supabase,
    businessId: business.id,
    startsAt,
    partySize: input.partySize,
    zonePreference: input.zonePreference,
  });

  let resource;
  if (assignmentMode === "manual") {
    resource = freeResources.find((r) => r.id === input.resourceId);
  } else {
    resource = freeResources[0];
  }

  if (!resource) {
    return { error: NO_SLOT_ERROR };
  }

  const endsAt = new Date(
    new Date(startsAt).getTime() + resource.duration_minutes * 60_000
  ).toISOString();

  const { error } = await supabase.from("reservations").insert({
    business_id: business.id,
    resource_id: resource.id,
    customer_name: input.customerName,
    customer_phone: input.customerPhone,
    customer_email: input.customerEmail,
    notes: input.notes,
    party_size: input.partySize,
    zone_preference: input.zonePreference,
    starts_at: startsAt,
    ends_at: endsAt,
    status: "confirmed",
  });

  if (error) {
    if (error.code === "23P01") {
      return { error: NO_SLOT_ERROR };
    }
    return { error: "No pudimos guardar la reserva. Probá de nuevo." };
  }

  return {};
}

export async function rescheduleRestaurantReservation(input: {
  reservationId: string;
  localDate: string;
  time: string;
  partySize: number;
  zonePreference: string | null;
  resourceId?: string | null;
}): Promise<{ error?: string }> {
  const business = await getCurrentBusiness();
  const supabase = await createClient();
  const startsAt = localSlotToUtcIso(input.localDate, input.time);

  // Re-derive from reservation_settings instead of trusting a client-sent
  // assignmentMode, same as createRestaurantReservation - a stale dialog left
  // open across an owner's mode change shouldn't apply the old mode.
  const { data: settings } = await supabase
    .from("reservation_settings")
    .select("assignment_mode")
    .eq("business_id", business.id)
    .maybeSingle();
  const assignmentMode = settings?.assignment_mode ?? "automatic";

  const freeResources = await listFreeResourcesAt({
    supabase,
    businessId: business.id,
    startsAt,
    partySize: input.partySize,
    zonePreference: input.zonePreference,
    excludeReservationId: input.reservationId,
  });

  let resource;
  if (assignmentMode === "manual") {
    resource = freeResources.find((r) => r.id === input.resourceId);
  } else {
    resource = freeResources[0];
  }

  if (!resource) {
    return { error: NO_SLOT_ERROR };
  }

  const endsAt = new Date(
    new Date(startsAt).getTime() + resource.duration_minutes * 60_000
  ).toISOString();

  const { error } = await supabase
    .from("reservations")
    .update({
      resource_id: resource.id,
      starts_at: startsAt,
      ends_at: endsAt,
    })
    .eq("id", input.reservationId)
    .eq("business_id", business.id)
    .in("status", ["confirmed", "en_curso"]);

  if (error) {
    if (error.code === "23P01") {
      return { error: NO_SLOT_ERROR };
    }
    return { error: "No pudimos guardar el cambio. Probá de nuevo." };
  }

  return {};
}

export async function syncNoShows(businessId: string): Promise<{ flagged: boolean }> {
  const supabase = await createClient();

  const { data } = await supabase
    .from("reservations")
    .update({ status: "no_show", no_show_at: new Date().toISOString() })
    .eq("business_id", businessId)
    .in("status", ["confirmed", "en_curso"])
    .is("arrived_at", null)
    .lt("starts_at", new Date(Date.now() - 15 * 60_000).toISOString())
    .select("id");

  return { flagged: (data?.length ?? 0) > 0 };
}
