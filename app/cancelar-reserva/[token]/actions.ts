"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { formatArgentinaDateTimeLabel } from "@/lib/reservations/public-booking.server";

export type CancelBookingDetails = {
  businessName: string;
  whenLabel: string;
  detailLabel: string;
  alreadyCancelled: boolean;
};

function detailLabelFor(reservation: {
  resources: { name: string } | null;
  services: { name: string } | null;
  professionals: { name: string } | null;
  class_instances: { class_definitions: { name: string } | null } | null;
}): string {
  if (reservation.resources) return `Mesa ${reservation.resources.name}`;
  if (reservation.services) {
    return reservation.professionals
      ? `${reservation.services.name} con ${reservation.professionals.name}`
      : reservation.services.name;
  }
  if (reservation.class_instances?.class_definitions) {
    return reservation.class_instances.class_definitions.name;
  }
  return "Tu turno";
}

export async function getCancelBookingDetails(token: string): Promise<CancelBookingDetails | null> {
  const supabase = createAdminClient();

  const { data: reservation } = await supabase
    .from("reservations")
    .select(
      "status, starts_at, businesses(name), resources(name), services(name), professionals(name), class_instances(class_definitions(name))"
    )
    .eq("cancellation_token", token)
    .maybeSingle();

  if (reservation) {
    const business = reservation.businesses as unknown as { name: string } | null;
    if (!business) return null;
    return {
      businessName: business.name,
      whenLabel: formatArgentinaDateTimeLabel(reservation.starts_at),
      detailLabel: detailLabelFor(
        reservation as unknown as Parameters<typeof detailLabelFor>[0]
      ),
      alreadyCancelled: reservation.status !== "confirmed",
    };
  }

  const { data: enrollment } = await supabase
    .from("class_enrollments")
    .select("status, class_definitions(name), businesses(name)")
    .eq("cancellation_token", token)
    .maybeSingle();

  if (enrollment) {
    const business = enrollment.businesses as unknown as { name: string } | null;
    const classDef = enrollment.class_definitions as unknown as { name: string } | null;
    if (!business) return null;
    return {
      businessName: business.name,
      whenLabel: "Todas las semanas",
      detailLabel: classDef?.name ?? "Tu clase recurrente",
      alreadyCancelled: enrollment.status !== "active",
    };
  }

  return null;
}

export async function cancelPublicBooking(token: string): Promise<{ error?: string }> {
  const supabase = createAdminClient();

  const { data: cancelledReservations } = await supabase
    .from("reservations")
    .update({ status: "cancelled" })
    .eq("cancellation_token", token)
    .eq("status", "confirmed")
    .select("id");

  if (cancelledReservations && cancelledReservations.length > 0) {
    return {};
  }

  // Not a single-reservation token (or already cancelled/past) - try the
  // enrollment-level token used for recurring gimnasio bookings, which
  // cancels the recurring spot itself plus every future, not-yet-happened
  // occurrence still tied to it (past occurrences stay as attendance
  // history). Each row update fires the same promote_waitlist_on_cancel
  // trigger a staff-initiated cancellation would.
  const { data: enrollment } = await supabase
    .from("class_enrollments")
    .select("id, status")
    .eq("cancellation_token", token)
    .maybeSingle();

  if (!enrollment) {
    return { error: "Este link no es válido." };
  }
  if (enrollment.status !== "active") {
    return { error: "Esta reserva ya estaba cancelada." };
  }

  await supabase
    .from("class_enrollments")
    .update({ status: "cancelled", cancelled_at: new Date().toISOString() })
    .eq("id", enrollment.id);

  await supabase
    .from("reservations")
    .update({ status: "cancelled" })
    .eq("enrollment_id", enrollment.id)
    .in("status", ["confirmed", "en_curso"])
    .gt("starts_at", new Date().toISOString());

  return {};
}
