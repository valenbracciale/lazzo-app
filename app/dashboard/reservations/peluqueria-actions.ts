"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentBusiness } from "@/lib/business";
import { localSlotToUtcIso } from "@/lib/reservations/availability.server";
import {
  fetchEligibleProfessionals,
  getAvailableSlotsForService,
  listFreeProfessionalsAt,
  type Professional,
} from "@/lib/reservations/peluqueria-availability.server";

export async function fetchAvailableSlotsForService(input: {
  serviceId: string;
  localDate: string;
  professionalId?: string | null;
}): Promise<string[]> {
  const business = await getCurrentBusiness();
  const supabase = await createClient();

  return getAvailableSlotsForService({
    supabase,
    businessId: business.id,
    serviceId: input.serviceId,
    localDate: input.localDate,
    professionalId: input.professionalId,
  });
}

export async function fetchEligibleProfessionalsForService(
  serviceId: string
): Promise<Professional[]> {
  const supabase = await createClient();
  return fetchEligibleProfessionals(supabase, serviceId);
}

type CreatePeluqueriaReservationInput = {
  customerName: string;
  customerPhone: string;
  customerEmail: string | null;
  notes: string | null;
  serviceId: string;
  localDate: string;
  time: string;
  professionalId?: string | null;
};

const NO_SLOT_ERROR = "Ese horario ya no tiene lugar disponible. Elegí otro horario.";

export async function createPeluqueriaReservation(
  input: CreatePeluqueriaReservationInput
): Promise<{ error?: string }> {
  const business = await getCurrentBusiness();
  const supabase = await createClient();
  const startsAt = localSlotToUtcIso(input.localDate, input.time);

  const { data: service } = await supabase
    .from("services")
    .select("duration_minutes")
    .eq("id", input.serviceId)
    .maybeSingle();

  if (!service) {
    return { error: "No pudimos guardar la reserva. Probá de nuevo." };
  }

  const freeProfessionals = await listFreeProfessionalsAt({
    supabase,
    serviceId: input.serviceId,
    startsAt,
    durationMinutes: service.duration_minutes,
  });

  let professionalId: string | undefined;

  if (business.role === "encargado") {
    const { data: claims } = await supabase.auth.getClaims();
    const userId = claims?.claims?.sub;
    const { data: membership } = await supabase
      .from("business_members")
      .select("professional_id")
      .eq("business_id", business.id)
      .eq("user_id", userId)
      .maybeSingle();

    const ownProfessionalId = membership?.professional_id;
    professionalId = freeProfessionals.find((p) => p.id === ownProfessionalId)?.id;
  } else if (input.professionalId) {
    professionalId = freeProfessionals.find((p) => p.id === input.professionalId)?.id;
  } else {
    professionalId = freeProfessionals[0]?.id;
  }

  if (!professionalId) {
    return { error: NO_SLOT_ERROR };
  }

  const endsAt = new Date(new Date(startsAt).getTime() + service.duration_minutes * 60_000).toISOString();

  const { error } = await supabase.from("reservations").insert({
    business_id: business.id,
    service_id: input.serviceId,
    professional_id: professionalId,
    customer_name: input.customerName,
    customer_phone: input.customerPhone,
    customer_email: input.customerEmail,
    notes: input.notes,
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
