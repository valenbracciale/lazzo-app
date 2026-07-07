import type { createClient } from "@/lib/supabase/server";
import {
  BUSINESS_UTC_OFFSET_MINUTES,
  formatLocalHm,
  getLocalDayOfWeek,
  localToUtcMs,
  utcIsoToLocalMs,
  type Shift,
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

function shiftWindowsForDate(shifts: Shift[], localDate: string): { start: number; end: number }[] {
  const dayOfWeek = getLocalDayOfWeek(localDate);
  return shifts
    .filter((s) => s.days_of_week.includes(dayOfWeek))
    .map((s) => ({
      start: localToUtcMs(localDate, s.start_time),
      end: localToUtcMs(localDate, s.end_time),
    }));
}

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
  maxDurationMinutes: number
): Promise<OccupiedReservation[]> {
  const dayStartMs = localToUtcMs(localDate, "00:00");
  const dayEndMs = dayStartMs + 24 * 60 * 60_000;
  const queryStart = new Date(dayStartMs - maxDurationMinutes * 60_000).toISOString();
  const queryEnd = new Date(dayEndMs).toISOString();

  const { data } = await supabase
    .from("reservations")
    .select("starts_at, ends_at, released_at")
    .eq("professional_id", professionalId)
    .eq("status", "confirmed")
    .lt("starts_at", queryEnd)
    .gte("starts_at", queryStart);

  return (data ?? []).map((r) => ({
    starts_at: r.starts_at,
    effectiveEndsAt: r.released_at ?? r.ends_at ?? r.starts_at,
  }));
}

// No fixed grid: the only meaningful "next available" times are where a
// shift opens, or where a previous appointment ends - exactly what the
// product spec describes ("el próximo horario es cuando termina el turno
// anterior").
function candidateStartTimes(
  windows: { start: number; end: number }[],
  occupied: OccupiedReservation[],
  durationMinutes: number
): number[] {
  const durationMs = durationMinutes * 60_000;
  const occupiedRanges = occupied.map((o) => ({
    start: new Date(o.starts_at).getTime(),
    end: new Date(o.effectiveEndsAt).getTime(),
  }));

  const anchors = new Set<number>([
    ...windows.map((w) => w.start),
    ...occupiedRanges.map((o) => o.end),
  ]);

  return Array.from(anchors)
    .filter((t) => {
      const fitsWindow = windows.some((w) => t >= w.start && t + durationMs <= w.end);
      if (!fitsWindow) return false;
      const overlaps = occupiedRanges.some((o) => t < o.end && o.start < t + durationMs);
      return !overlaps;
    })
    .sort((a, b) => a - b);
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
}: {
  supabase: Supabase;
  businessId: string;
  serviceId: string;
  localDate: string;
  professionalId?: string | null;
}): Promise<string[]> {
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

  const perProfessionalCandidates = await Promise.all(
    professionals.map(async (professional) => {
      const windows = shiftWindowsForDate(
        effectiveShiftsForProfessional(allShifts, professional.id),
        localDate
      );
      if (windows.length === 0) return [];
      const occupied = await listOccupiedForProfessional(
        supabase,
        professional.id,
        localDate,
        service.duration_minutes
      );
      return candidateStartTimes(windows, occupied, service.duration_minutes);
    })
  );

  const union = new Set<number>(perProfessionalCandidates.flat());
  return Array.from(union)
    .sort((a, b) => a - b)
    .map((ms) => formatLocalHm(utcIsoToLocalMs(new Date(ms).toISOString())));
}

export async function listFreeProfessionalsAt({
  supabase,
  serviceId,
  startsAt,
  durationMinutes,
}: {
  supabase: Supabase;
  serviceId: string;
  startsAt: string;
  durationMinutes: number;
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
      durationMinutes
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
