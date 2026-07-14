"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentBusiness } from "@/lib/business";
import {
  addLocalDays,
  getAvailableSlots,
  listFreeResourcesAt,
  localSlotToUtcIso,
  type SlotAvailability,
} from "@/lib/reservations/availability.server";

// A slot's `time` ("HH:MM") alone is ambiguous once a shift can cross
// midnight - "00:15" could belong to the picked localDate or to the day
// after, depending on which shift produced it. `dayOffset` (from the slot
// list returned by fetchAvailableSlots) disambiguates that before resolving
// to an absolute instant.
function resolveStartsAt(localDate: string, time: string, dayOffset: number | undefined): string {
  return localSlotToUtcIso(addLocalDays(localDate, dayOffset ?? 0), time);
}

type CreateRestaurantReservationInput = {
  customerName: string;
  customerPhone: string;
  customerEmail: string | null;
  notes: string | null;
  localDate: string;
  time: string;
  dayOffset?: number;
  partySize: number;
  zonePreference: string | null;
  resourceId?: string | null;
};

const NO_SLOT_ERROR = "Ese horario ya no tiene lugar disponible. Elegí otro horario.";

export async function fetchAvailableSlots(input: {
  localDate: string;
  zonePreference: string | null;
  excludeReservationId?: string | null;
}): Promise<SlotAvailability[]> {
  const business = await getCurrentBusiness();
  const supabase = await createClient();

  return getAvailableSlots({
    supabase,
    businessId: business.id,
    localDate: input.localDate,
    zonePreference: input.zonePreference,
    excludeReservationId: input.excludeReservationId,
  });
}

export async function fetchFreeResources(input: {
  localDate: string;
  time: string;
  dayOffset?: number;
  partySize: number;
  zonePreference: string | null;
  excludeReservationId?: string | null;
}): Promise<{ id: string; name: string; capacity: number; zone_name: string | null }[]> {
  const business = await getCurrentBusiness();
  const supabase = await createClient();
  const startsAt = resolveStartsAt(input.localDate, input.time, input.dayOffset);

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
  const startsAt = resolveStartsAt(input.localDate, input.time, input.dayOffset);

  const { data: settings } = await supabase
    .from("reservation_settings")
    .select("assignment_mode, max_party_size")
    .eq("business_id", business.id)
    .maybeSingle();

  const maxPartySize = settings?.max_party_size ?? 20;
  if (input.partySize > maxPartySize) {
    return { error: `El máximo de comensales por reserva es ${maxPartySize}.` };
  }

  const assignmentMode = settings?.assignment_mode ?? "automatic";

  const freeResources = await listFreeResourcesAt({
    supabase,
    businessId: business.id,
    startsAt,
    partySize: input.partySize,
    zonePreference: input.zonePreference,
  });

  // No free resource at all (of any size) means there's truly no room at
  // this time - block. But a party too big for every free table's capacity
  // is not the same problem: the reservation still goes through, just
  // without a resource_id, for the business to assign manually afterwards
  // (e.g. by combining tables) via the "Asignar mesa" action.
  if (freeResources.length === 0) {
    return { error: NO_SLOT_ERROR };
  }

  let resource;
  if (assignmentMode === "manual") {
    if (input.resourceId) {
      resource = freeResources.find((r) => r.id === input.resourceId);
      if (!resource) return { error: NO_SLOT_ERROR };
    }
  } else {
    resource = freeResources.find((r) => r.capacity >= input.partySize);
  }

  const durationMinutes =
    resource?.duration_minutes ?? Math.max(...freeResources.map((r) => r.duration_minutes));
  const endsAt = new Date(new Date(startsAt).getTime() + durationMinutes * 60_000).toISOString();

  const { error } = await supabase.from("reservations").insert({
    business_id: business.id,
    resource_id: resource?.id ?? null,
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
  dayOffset?: number;
  partySize: number;
  zonePreference: string | null;
  resourceId?: string | null;
}): Promise<{ error?: string }> {
  const business = await getCurrentBusiness();
  const supabase = await createClient();
  const startsAt = resolveStartsAt(input.localDate, input.time, input.dayOffset);

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

  // Same rule as createRestaurantReservation: no free resource at all blocks
  // the move, but a party too big for every free table's capacity is allowed
  // through without a resource_id instead.
  if (freeResources.length === 0) {
    return { error: NO_SLOT_ERROR };
  }

  let resource;
  if (assignmentMode === "manual") {
    if (input.resourceId) {
      resource = freeResources.find((r) => r.id === input.resourceId);
      if (!resource) return { error: NO_SLOT_ERROR };
    }
  } else {
    resource = freeResources.find((r) => r.capacity >= input.partySize);
  }

  const durationMinutes =
    resource?.duration_minutes ?? Math.max(...freeResources.map((r) => r.duration_minutes));
  const endsAt = new Date(new Date(startsAt).getTime() + durationMinutes * 60_000).toISOString();

  const { error } = await supabase
    .from("reservations")
    .update({
      resource_id: resource?.id ?? null,
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

// For reservations that were confirmed without a table (any channel that
// doesn't assign one up front, e.g. public booking under manual assignment
// mode) - lets the business pick a table after the fact, reusing the same
// availability check as manual assignment at creation time.
export async function fetchFreeResourcesForReservation(
  reservationId: string
): Promise<{ id: string; name: string; capacity: number; zone_name: string | null }[]> {
  const business = await getCurrentBusiness();
  const supabase = await createClient();

  const { data: reservation } = await supabase
    .from("reservations")
    .select("starts_at, party_size, zone_preference")
    .eq("id", reservationId)
    .eq("business_id", business.id)
    .maybeSingle();

  if (!reservation) return [];

  const resources = await listFreeResourcesAt({
    supabase,
    businessId: business.id,
    startsAt: reservation.starts_at,
    partySize: reservation.party_size,
    zonePreference: reservation.zone_preference,
    excludeReservationId: reservationId,
  });

  return resources.map((r) => ({
    id: r.id,
    name: r.name,
    capacity: r.capacity,
    zone_name: r.zone_name,
  }));
}

export async function assignTableToReservation(input: {
  reservationId: string;
  resourceId: string;
}): Promise<{ error?: string }> {
  const business = await getCurrentBusiness();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("reservations")
    .update({ resource_id: input.resourceId })
    .eq("id", input.reservationId)
    .eq("business_id", business.id)
    .eq("status", "confirmed")
    .is("resource_id", null)
    .select("id");

  if (error) {
    if (error.code === "23P01") {
      return { error: "Esa mesa ya está ocupada en ese horario. Elegí otra." };
    }
    return { error: "No pudimos asignar la mesa. Probá de nuevo." };
  }

  if (!data || data.length === 0) {
    return { error: "Esta reserva ya no está disponible para asignar mesa." };
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
