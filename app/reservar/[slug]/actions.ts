"use server";

import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  addLocalDays,
  getAvailableSlots,
  listFreeResourcesAt,
  localSlotToUtcIso,
  type SlotAvailability,
} from "@/lib/reservations/availability.server";
import {
  fetchEligibleProfessionals,
  getAvailableSlotsForService,
  listFreeProfessionalsAt,
  type Professional,
} from "@/lib/reservations/peluqueria-availability.server";
import {
  listClassInstancesForDate,
  type ClassInstanceWithSeats,
} from "@/lib/reservations/gimnasio-classes.server";
import {
  checkPublicBookingCooldown,
  formatArgentinaDateTimeLabel,
  isHoneypotTriggered,
  resolvePublicBusiness,
  validateBookingWindow,
} from "@/lib/reservations/public-booking.server";
import { sendPublicBookingConfirmationEmail } from "@/lib/email/resend.server";

const GENERIC_ERROR = "No pudimos guardar la reserva. Probá de nuevo.";
const NO_SLOT_ERROR = "Ese horario ya no tiene lugar disponible. Elegí otro horario.";
const INVALID_EMAIL_ERROR = "Ingresá un email válido.";
const MISSING_CONTACT_ERROR = "Completá tu nombre y teléfono.";

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

function resolveStartsAt(localDate: string, time: string, dayOffset: number | undefined): string {
  return localSlotToUtcIso(addLocalDays(localDate, dayOffset ?? 0), time);
}

async function getOrigin(): Promise<string> {
  const headersList = await headers();
  const host = headersList.get("host");
  const protocol = host?.startsWith("localhost") ? "http" : "https";
  return `${protocol}://${host}`;
}

function buildCancelUrl(origin: string, token: string): string {
  return `${origin}/cancelar-reserva/${token}`;
}

type ContactFields = { customerName: string; customerPhone: string; customerEmail: string; website?: string };

function validateContact(input: ContactFields): string | null {
  if (isHoneypotTriggered(input.website)) return "honeypot";
  if (!input.customerName.trim() || !input.customerPhone.trim()) return MISSING_CONTACT_ERROR;
  if (!isValidEmail(input.customerEmail)) return INVALID_EMAIL_ERROR;
  return null;
}

// ---------- Restaurante/bar ----------

export async function fetchPublicRestaurantSlots(input: {
  slug: string;
  localDate: string;
  partySize: number;
  zonePreference: string | null;
}): Promise<SlotAvailability[]> {
  const supabase = createAdminClient();
  const business = await resolvePublicBusiness(supabase, input.slug);
  if (!business || business.businessType !== "restaurante_bar") return [];

  const slots = await getAvailableSlots({
    supabase,
    businessId: business.id,
    localDate: input.localDate,
    partySize: input.partySize,
    zonePreference: input.zonePreference,
  });

  return slots.filter(
    (slot) =>
      !validateBookingWindow(
        new Date(resolveStartsAt(input.localDate, slot.time, slot.dayOffset)).getTime(),
        business
      )
  );
}

export async function fetchPublicRestaurantResources(input: {
  slug: string;
  localDate: string;
  time: string;
  dayOffset?: number;
  partySize: number;
  zonePreference: string | null;
}): Promise<{ id: string; name: string; capacity: number; zone_name: string | null }[]> {
  const supabase = createAdminClient();
  const business = await resolvePublicBusiness(supabase, input.slug);
  if (!business || business.businessType !== "restaurante_bar") return [];

  const startsAt = resolveStartsAt(input.localDate, input.time, input.dayOffset);
  const resources = await listFreeResourcesAt({
    supabase,
    businessId: business.id,
    startsAt,
    partySize: input.partySize,
    zonePreference: input.zonePreference,
  });

  return resources.map((r) => ({ id: r.id, name: r.name, capacity: r.capacity, zone_name: r.zone_name }));
}

export async function createPublicRestaurantReservation(input: {
  slug: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  notes: string | null;
  localDate: string;
  time: string;
  dayOffset?: number;
  partySize: number;
  zonePreference: string | null;
  resourceId?: string | null;
  website?: string;
}): Promise<{ error?: string; cancelUrl?: string }> {
  const contactError = validateContact(input);
  if (contactError === "honeypot") return {};
  if (contactError) return { error: contactError };

  const supabase = createAdminClient();
  const business = await resolvePublicBusiness(supabase, input.slug);
  if (!business || business.businessType !== "restaurante_bar") {
    return { error: GENERIC_ERROR };
  }

  const startsAt = resolveStartsAt(input.localDate, input.time, input.dayOffset);
  const windowError = validateBookingWindow(new Date(startsAt).getTime(), business);
  if (windowError) return { error: windowError };

  const cooldownError = await checkPublicBookingCooldown(supabase, business.id, input.customerPhone);
  if (cooldownError) return { error: cooldownError };

  const [{ data: settings }, freeResources] = await Promise.all([
    supabase.from("reservation_settings").select("assignment_mode").eq("business_id", business.id).maybeSingle(),
    listFreeResourcesAt({
      supabase,
      businessId: business.id,
      startsAt,
      partySize: input.partySize,
      zonePreference: input.zonePreference,
    }),
  ]);

  const assignmentMode = settings?.assignment_mode ?? "automatic";
  const resource =
    assignmentMode === "manual"
      ? freeResources.find((r) => r.id === input.resourceId)
      : freeResources[0];

  if (!resource) return { error: NO_SLOT_ERROR };

  const endsAt = new Date(new Date(startsAt).getTime() + resource.duration_minutes * 60_000).toISOString();
  const cancellationToken = crypto.randomUUID();

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
    source: "public",
    cancellation_token: cancellationToken,
  });

  if (error) {
    if (error.code === "23P01") return { error: NO_SLOT_ERROR };
    return { error: GENERIC_ERROR };
  }

  const origin = await getOrigin();
  const cancelUrl = buildCancelUrl(origin, cancellationToken);
  await sendPublicBookingConfirmationEmail({
    to: input.customerEmail,
    customerName: input.customerName,
    businessName: business.name,
    whenLabel: formatArgentinaDateTimeLabel(startsAt),
    detailLabel: `Mesa para ${input.partySize} persona${input.partySize === 1 ? "" : "s"}`,
    cancelUrl,
  });

  return { cancelUrl };
}

// ---------- Peluquería/salón ----------

export async function fetchPublicServices(
  slug: string
): Promise<{ id: string; name: string; duration_minutes: number }[]> {
  const supabase = createAdminClient();
  const business = await resolvePublicBusiness(supabase, slug);
  if (!business || business.businessType !== "peluqueria_salon") return [];

  const { data } = await supabase
    .from("services")
    .select("id, name, duration_minutes")
    .eq("business_id", business.id)
    .order("name", { ascending: true });

  return data ?? [];
}

export async function fetchPublicEligibleProfessionals(slug: string, serviceId: string): Promise<Professional[]> {
  const supabase = createAdminClient();
  const business = await resolvePublicBusiness(supabase, slug);
  if (!business || business.businessType !== "peluqueria_salon") return [];
  return fetchEligibleProfessionals(supabase, serviceId);
}

export async function fetchPublicPeluqueriaSlots(input: {
  slug: string;
  serviceId: string;
  localDate: string;
  professionalId?: string | null;
}): Promise<SlotAvailability[]> {
  const supabase = createAdminClient();
  const business = await resolvePublicBusiness(supabase, input.slug);
  if (!business || business.businessType !== "peluqueria_salon") return [];

  const slots = await getAvailableSlotsForService({
    supabase,
    businessId: business.id,
    serviceId: input.serviceId,
    localDate: input.localDate,
    professionalId: input.professionalId,
  });

  return slots.filter(
    (slot) =>
      !validateBookingWindow(
        new Date(resolveStartsAt(input.localDate, slot.time, slot.dayOffset)).getTime(),
        business
      )
  );
}

export async function createPublicPeluqueriaReservation(input: {
  slug: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  notes: string | null;
  serviceId: string;
  localDate: string;
  time: string;
  dayOffset?: number;
  professionalId?: string | null;
  website?: string;
}): Promise<{ error?: string; cancelUrl?: string }> {
  const contactError = validateContact(input);
  if (contactError === "honeypot") return {};
  if (contactError) return { error: contactError };

  const supabase = createAdminClient();
  const business = await resolvePublicBusiness(supabase, input.slug);
  if (!business || business.businessType !== "peluqueria_salon") {
    return { error: GENERIC_ERROR };
  }

  const startsAt = resolveStartsAt(input.localDate, input.time, input.dayOffset);
  const windowError = validateBookingWindow(new Date(startsAt).getTime(), business);
  if (windowError) return { error: windowError };

  const cooldownError = await checkPublicBookingCooldown(supabase, business.id, input.customerPhone);
  if (cooldownError) return { error: cooldownError };

  const { data: service } = await supabase
    .from("services")
    .select("name, duration_minutes")
    .eq("id", input.serviceId)
    .eq("business_id", business.id)
    .maybeSingle();
  if (!service) return { error: GENERIC_ERROR };

  const freeProfessionals = await listFreeProfessionalsAt({
    supabase,
    serviceId: input.serviceId,
    startsAt,
    durationMinutes: service.duration_minutes,
  });

  const professional = input.professionalId
    ? freeProfessionals.find((p) => p.id === input.professionalId)
    : freeProfessionals[0];

  if (!professional) return { error: NO_SLOT_ERROR };

  const endsAt = new Date(new Date(startsAt).getTime() + service.duration_minutes * 60_000).toISOString();
  const cancellationToken = crypto.randomUUID();

  const { error } = await supabase.from("reservations").insert({
    business_id: business.id,
    service_id: input.serviceId,
    professional_id: professional.id,
    customer_name: input.customerName,
    customer_phone: input.customerPhone,
    customer_email: input.customerEmail,
    notes: input.notes,
    starts_at: startsAt,
    ends_at: endsAt,
    status: "confirmed",
    source: "public",
    cancellation_token: cancellationToken,
  });

  if (error) {
    if (error.code === "23P01") return { error: NO_SLOT_ERROR };
    return { error: GENERIC_ERROR };
  }

  const origin = await getOrigin();
  const cancelUrl = buildCancelUrl(origin, cancellationToken);
  await sendPublicBookingConfirmationEmail({
    to: input.customerEmail,
    customerName: input.customerName,
    businessName: business.name,
    whenLabel: formatArgentinaDateTimeLabel(startsAt),
    detailLabel: `${service.name} con ${professional.name}`,
    cancelUrl,
  });

  return { cancelUrl };
}

// ---------- Gimnasio/academia ----------

export async function fetchPublicClassInstances(
  slug: string,
  localDate: string
): Promise<ClassInstanceWithSeats[]> {
  const supabase = createAdminClient();
  const business = await resolvePublicBusiness(supabase, slug);
  if (!business || business.businessType !== "gimnasio_academia") return [];

  const instances = await listClassInstancesForDate(supabase, business.id, localDate);
  return instances.filter((i) => !validateBookingWindow(new Date(i.starts_at).getTime(), business));
}

export async function createPublicGimnasioReservation(input: {
  slug: string;
  classInstanceId: string;
  mode: "punctual" | "recurring";
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  website?: string;
}): Promise<{ error?: string; classFull?: boolean; waitlisted?: boolean; cancelUrl?: string }> {
  const contactError = validateContact(input);
  if (contactError === "honeypot") return {};
  if (contactError) return { error: contactError };

  const supabase = createAdminClient();
  const business = await resolvePublicBusiness(supabase, input.slug);
  if (!business || business.businessType !== "gimnasio_academia") {
    return { error: GENERIC_ERROR };
  }

  const { data: instance } = await supabase
    .from("class_instances")
    .select("id, class_definition_id, starts_at, class_definitions(name)")
    .eq("id", input.classInstanceId)
    .eq("business_id", business.id)
    .maybeSingle();
  if (!instance) return { error: GENERIC_ERROR };

  const windowError = validateBookingWindow(new Date(instance.starts_at).getTime(), business);
  if (windowError) return { error: windowError };

  const cooldownError = await checkPublicBookingCooldown(supabase, business.id, input.customerPhone);
  if (cooldownError) return { error: cooldownError };

  const { data: existingStudent } = await supabase
    .from("students")
    .select("id")
    .eq("business_id", business.id)
    .eq("phone", input.customerPhone)
    .maybeSingle();

  let studentId = existingStudent?.id as string | undefined;
  if (!studentId) {
    const { data: newStudent, error: studentError } = await supabase
      .from("students")
      .insert({ business_id: business.id, name: input.customerName, phone: input.customerPhone, email: input.customerEmail })
      .select("id")
      .single();
    if (studentError || !newStudent) return { error: GENERIC_ERROR };
    studentId = newStudent.id;
  } else {
    await supabase
      .from("students")
      .update({ name: input.customerName, email: input.customerEmail })
      .eq("id", studentId);
  }

  const rpcName = input.mode === "punctual" ? "enroll_student_punctual" : "enroll_student_recurring";
  const rpcArgs =
    input.mode === "punctual"
      ? { p_instance_id: instance.id, p_student_id: studentId }
      : { p_class_definition_id: instance.class_definition_id, p_student_id: studentId };

  const { data: enrollmentId, error: enrollError } = await supabase.rpc(rpcName, rpcArgs);

  if (enrollError) {
    if (enrollError.message?.includes("class_full")) {
      const { error: waitlistError } = await supabase.from("waitlist_entries").insert({
        business_id: business.id,
        class_instance_id: instance.id,
        student_id: studentId,
        status: "waiting",
      });
      // 23505: already on this class's waitlist - not a failure, just a no-op.
      if (waitlistError && waitlistError.code !== "23505") {
        return { error: GENERIC_ERROR };
      }
      return { classFull: true, waitlisted: true };
    }
    return { error: GENERIC_ERROR };
  }

  // enroll_student_punctual/recurring insert `reservations` rows without a
  // cancellation_token (they're also used by the internal, session-based
  // dashboard flow, which doesn't need one). Recurring enrollment inserts one
  // row per future materialized occurrence sharing this enrollment_id, so
  // the cancel link for that mode lives on class_enrollments (cancels the
  // whole recurring spot) instead of a single reservations row.
  const cancellationToken = crypto.randomUUID();
  if (input.mode === "punctual") {
    await supabase
      .from("reservations")
      .update({ source: "public", cancellation_token: cancellationToken })
      .eq("enrollment_id", enrollmentId);
  } else {
    await supabase.from("reservations").update({ source: "public" }).eq("enrollment_id", enrollmentId);
    await supabase
      .from("class_enrollments")
      .update({ cancellation_token: cancellationToken })
      .eq("id", enrollmentId);
  }

  const origin = await getOrigin();
  const cancelUrl = buildCancelUrl(origin, cancellationToken);
  const className = (instance.class_definitions as unknown as { name: string } | null)?.name ?? "tu clase";
  await sendPublicBookingConfirmationEmail({
    to: input.customerEmail,
    customerName: input.customerName,
    businessName: business.name,
    whenLabel: formatArgentinaDateTimeLabel(instance.starts_at),
    detailLabel: input.mode === "recurring" ? `${className} (todas las semanas)` : className,
    cancelUrl,
  });

  return { cancelUrl };
}
