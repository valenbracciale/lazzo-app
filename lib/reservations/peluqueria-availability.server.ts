import type { createClient } from "@/lib/supabase/server";
import {
  BUSINESS_UTC_OFFSET_MINUTES,
  formatLocalHm,
  generateSlotStartsUtcMs,
  getShiftWindowsForDate,
  localToUtcMs,
  utcIsoToLocalMs,
  type Shift,
  type SlotAvailability,
} from "@/lib/reservations/availability.server";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export type Service = {
  id: string;
  name: string;
  duration_minutes: number;
};

export type Professional = {
  id: string;
  name: string;
};

type OccupiedReservation = {
  starts_at: string;
  effectiveEndsAt: string;
};

function effectiveShiftsForProfessional(
  allShifts: (Shift & { professional_id: string | null })[],
  professionalId: string
): Shift[] {
  const own = allShifts.filter((s) => s.professional_id === professionalId);
  return own.length > 0 ? own : allShifts.filter((s) => s.professional_id === null);
}

async function listOccupiedForProfessional(
  supabase: Supabase,
  professionalId: string,
  localDate: string,
  maxDurationMinutes: number,
  excludeReservationId?: string | null
): Promise<OccupiedReservation[]> {
  const dayStartMs = localToUtcMs(localDate, "00:00");
  const dayEndMs = dayStartMs + 24 * 60 * 60_000;
  const queryStart = new Date(dayStartMs - maxDurationMinutes * 60_000).toISOString();
  const queryEnd = new Date(dayEndMs).toISOString();

  let query = supabase
    .from("reservations")
    .select("starts_at, ends_at, released_at")
    .eq("professional_id", professionalId)
    .in("status", ["confirmed", "en_curso"])
    .lt("starts_at", queryEnd)
    .gte("starts_at", queryStart);

  // When rescheduling an existing reservation, it must not count as its own
  // conflict against the professional it's already assigned to.
  if (excludeReservationId) {
    query = query.neq("id", excludeReservationId);
  }

  const { data } = await query;

  return (data ?? []).map((r) => ({
    starts_at: r.starts_at,
    effectiveEndsAt: r.released_at ?? r.ends_at ?? r.starts_at,
  }));
}

function isFreeAt(
  startMs: number,
  windows: { start: number; end: number }[],
  occupied: OccupiedReservation[],
  durationMs: number
): boolean {
  const fitsWindow = windows.some((w) => startMs >= w.start && startMs + durationMs <= w.end);
  if (!fitsWindow) return false;
  const overlaps = occupied.some((o) => {
    const oStart = new Date(o.starts_at).getTime();
    const oEnd = new Date(o.effectiveEndsAt).getTime();
    return startMs < oEnd && oStart < startMs + durationMs;
  });
  return !overlaps;
}

async function fetchAllShifts(supabase: Supabase, businessId: string) {
  const { data } = await supabase
    .from("shifts")
    .select("id, name, days_of_week, start_time, end_time, professional_id")
    .eq("business_id", businessId);
  return (data ?? []) as (Shift & { professional_id: string | null })[];
}

export async function fetchEligibleProfessionals(
  supabase: Supabase,
  serviceId: string
): Promise<Professional[]> {
  const { data } = await supabase
    .from("professional_services")
    .select("professional_id, professionals(id, name)")
    .eq("service_id", serviceId);

  return (data ?? [])
    .map((row) => row.professionals as unknown as Professional | null)
    .filter((p): p is Professional => p !== null);
}

export async function getAvailableSlotsForService({
  supabase,
  businessId,
  serviceId,
  localDate,
  professionalId,
  excludeReservationId,
}: {
  supabase: Supabase;
  businessId: string;
  serviceId: string;
  localDate: string;
  professionalId?: string | null;
  excludeReservationId?: string | null;
}): Promise<SlotAvailability[]> {
  const { data: service } = await supabase
    .from("services")
    .select("duration_minutes")
    .eq("id", serviceId)
    .maybeSingle();
  if (!service) return [];

  const allShifts = await fetchAllShifts(supabase, businessId);

  const professionals: Professional[] = professionalId
    ? [{ id: professionalId, name: "" }]
    : await fetchEligibleProfessionals(supabase, serviceId);
  if (professionals.length === 0) return [];

  const durationMs = service.duration_minutes * 60_000;

  const perProfessional = await Promise.all(
    professionals.map(async (professional) => {
      const windows = getShiftWindowsForDate(
        effectiveShiftsForProfessional(allShifts, professional.id),
        localDate
      );
      if (windows.length === 0) return { windows: [] as { start: number; end: number }[], occupied: [] as OccupiedReservation[] };
      const occupied = await listOccupiedForProfessional(
        supabase,
        professional.id,
        localDate,
        service.duration_minutes,
        excludeReservationId
      );
      return { windows, occupied };
    })
  );

  // The grid domain is the union of every eligible professional's shift
  // windows - a slot only appears at all if someone could conceivably work
  // it; whether it's actually free is checked per-slot below.
  const allWindows = perProfessional.flatMap((p) => p.windows);
  if (allWindows.length === 0) return [];
  const slotStarts = generateSlotStartsUtcMs(allWindows);
  const dayStartMs = localToUtcMs(localDate, "00:00");

  return slotStarts.map((startMs) => ({
    time: formatLocalHm(utcIsoToLocalMs(new Date(startMs).toISOString())),
    dayOffset: Math.floor((startMs - dayStartMs) / (24 * 60 * 60_000)),
    available: perProfessional.some(({ windows, occupied }) =>
      isFreeAt(startMs, windows, occupied, durationMs)
    ),
  }));
}

export async function listFreeProfessionalsAt({
  supabase,
  serviceId,
  startsAt,
  durationMinutes,
  excludeReservationId,
}: {
  supabase: Supabase;
  serviceId: string;
  startsAt: string;
  durationMinutes: number;
  excludeReservationId?: string | null;
}): Promise<Professional[]> {
  const professionals = await fetchEligibleProfessionals(supabase, serviceId);
  if (professionals.length === 0) return [];

  const localDate = new Date(new Date(startsAt).getTime() + BUSINESS_UTC_OFFSET_MINUTES * 60_000)
    .toISOString()
    .slice(0, 10);
  const startMs = new Date(startsAt).getTime();
  const endMs = startMs + durationMinutes * 60_000;

  const free: Professional[] = [];
  for (const professional of professionals) {
    const occupied = await listOccupiedForProfessional(
      supabase,
      professional.id,
      localDate,
      durationMinutes,
      excludeReservationId
    );
    const overlaps = occupied.some((o) => {
      const oStart = new Date(o.starts_at).getTime();
      const oEnd = new Date(o.effectiveEndsAt).getTime();
      return startMs < oEnd && oStart < endMs;
    });
    if (!overlaps) free.push(professional);
  }

  return free;
}
