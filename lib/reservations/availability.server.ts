import type { createClient } from "@/lib/supabase/server";

// Businesses in this app are Argentina-based (see lib/datetime.ts). Argentina
// uses a fixed UTC-3 offset year-round (no DST). Unlike lib/datetime.ts's
// client-only helpers, which rely on the browser's local timezone, this file
// runs server-side (Server Components / Server Actions), where the process
// timezone may not match Argentina at all (e.g. UTC in production) - so local
// <-> UTC conversions here use this explicit fixed offset instead of the
// server's own clock/timezone.
export const BUSINESS_UTC_OFFSET_MINUTES = -180;
export const SLOT_MINUTES = 15;

export type SlotAvailability = { time: string; available: boolean };

type Supabase = Awaited<ReturnType<typeof createClient>>;

export type Shift = {
  id: string;
  name: string;
  days_of_week: number[];
  start_time: string;
  end_time: string;
};

export type Resource = {
  id: string;
  name: string;
  capacity: number;
  zone_name: string | null;
  duration_minutes: number;
};

type OccupiedReservation = {
  resource_id: string;
  starts_at: string;
  effectiveEndsAt: string;
};

export function parseLocalDate(localDate: string) {
  const [year, month, day] = localDate.split("-").map(Number);
  return { year, month, day };
}

function parseHms(hms: string) {
  const [hour, minute] = hms.split(":").map(Number);
  return { hour, minute };
}

export function localToUtcMs(localDate: string, hms: string): number {
  const { year, month, day } = parseLocalDate(localDate);
  const { hour, minute } = parseHms(hms);
  return Date.UTC(year, month - 1, day, hour, minute, 0, 0) - BUSINESS_UTC_OFFSET_MINUTES * 60_000;
}

export function utcIsoToLocalMs(iso: string): number {
  return new Date(iso).getTime() + BUSINESS_UTC_OFFSET_MINUTES * 60_000;
}

export function getLocalDayOfWeek(localDate: string): number {
  const { year, month, day } = parseLocalDate(localDate);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

export function formatLocalHm(localMs: number): string {
  const d = new Date(localMs);
  const hours = String(d.getUTCHours()).padStart(2, "0");
  const minutes = String(d.getUTCMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}

export function getShiftWindowsForDate(
  shifts: Shift[],
  localDate: string
): { start: number; end: number }[] {
  const dayOfWeek = getLocalDayOfWeek(localDate);
  return shifts
    .filter((s) => s.days_of_week.includes(dayOfWeek))
    .map((s) => ({
      start: localToUtcMs(localDate, s.start_time),
      end: localToUtcMs(localDate, s.end_time),
    }));
}

export function generateSlotStartsUtcMs(windows: { start: number; end: number }[]): number[] {
  const slots = new Set<number>();
  for (const w of windows) {
    for (let t = w.start; t < w.end; t += SLOT_MINUTES * 60_000) {
      slots.add(t);
    }
  }
  return Array.from(slots).sort((a, b) => a - b);
}

export async function listOccupiedReservations(
  supabase: Supabase,
  businessId: string,
  localDate: string,
  maxDurationMinutes: number
): Promise<OccupiedReservation[]> {
  const dayStartMs = localToUtcMs(localDate, "00:00");
  const dayEndMs = dayStartMs + 24 * 60 * 60_000;
  // Extend the lower bound back by the longest possible occupation so a
  // reservation that started the previous day but still occupies a table
  // into this one isn't missed.
  const queryStart = new Date(dayStartMs - maxDurationMinutes * 60_000).toISOString();
  const queryEnd = new Date(dayEndMs).toISOString();

  const { data } = await supabase
    .from("reservations")
    .select("resource_id, starts_at, ends_at, released_at")
    .eq("business_id", businessId)
    .in("status", ["confirmed", "en_curso"])
    .not("resource_id", "is", null)
    .lt("starts_at", queryEnd)
    .gte("starts_at", queryStart);

  return (data ?? [])
    .filter((r): r is typeof r & { resource_id: string } => r.resource_id !== null)
    .map((r) => ({
      resource_id: r.resource_id,
      starts_at: r.starts_at,
      effectiveEndsAt: r.released_at ?? r.ends_at ?? r.starts_at,
    }));
}

function isResourceFreeAt(
  resource: Resource,
  startMs: number,
  occupied: OccupiedReservation[]
): boolean {
  const endMs = startMs + resource.duration_minutes * 60_000;
  return !occupied.some((o) => {
    if (o.resource_id !== resource.id) return false;
    const oStart = new Date(o.starts_at).getTime();
    const oEnd = new Date(o.effectiveEndsAt).getTime();
    return startMs < oEnd && oStart < endMs;
  });
}

function fittingResources(
  resources: Resource[],
  partySize: number,
  zonePreference: string | null | undefined
): Resource[] {
  const byCapacity = resources.filter((r) => r.capacity >= partySize);
  if (!zonePreference) return byCapacity;
  const inZone = byCapacity.filter((r) => r.zone_name === zonePreference);
  // "Zona preferida" is a soft preference, not a hard requirement: fall back
  // to any zone if the preferred one has no table big enough at all.
  return inZone.length > 0 ? inZone : byCapacity;
}

export async function getAvailableSlots({
  supabase,
  businessId,
  localDate,
  partySize,
  zonePreference,
}: {
  supabase: Supabase;
  businessId: string;
  localDate: string;
  partySize: number;
  zonePreference?: string | null;
}): Promise<SlotAvailability[]> {
  const [{ data: shifts }, { data: resources }] = await Promise.all([
    supabase.from("shifts").select("id, name, days_of_week, start_time, end_time").eq("business_id", businessId),
    supabase
      .from("resources")
      .select("id, name, capacity, zone_name, duration_minutes")
      .eq("business_id", businessId),
  ]);

  const allResources = (resources ?? []) as Resource[];
  const candidates = fittingResources(allResources, partySize, zonePreference);
  if (candidates.length === 0) return [];

  const maxDuration = Math.max(...allResources.map((r) => r.duration_minutes), 0);
  const occupied = await listOccupiedReservations(supabase, businessId, localDate, maxDuration);

  const windows = getShiftWindowsForDate((shifts ?? []) as Shift[], localDate);
  const slotStarts = generateSlotStartsUtcMs(windows);

  return slotStarts.map((startMs) => ({
    time: formatLocalHm(utcIsoToLocalMs(new Date(startMs).toISOString())),
    available: candidates.some((resource) => isResourceFreeAt(resource, startMs, occupied)),
  }));
}

export async function listFreeResourcesAt({
  supabase,
  businessId,
  startsAt,
  partySize,
  zonePreference,
}: {
  supabase: Supabase;
  businessId: string;
  startsAt: string;
  partySize: number;
  zonePreference?: string | null;
}): Promise<Resource[]> {
  const { data: resources } = await supabase
    .from("resources")
    .select("id, name, capacity, zone_name, duration_minutes")
    .eq("business_id", businessId);

  const allResources = (resources ?? []) as Resource[];
  const candidates = fittingResources(allResources, partySize, zonePreference);
  if (candidates.length === 0) return [];

  const localDate = new Date(
    new Date(startsAt).getTime() + BUSINESS_UTC_OFFSET_MINUTES * 60_000
  )
    .toISOString()
    .slice(0, 10);
  const maxDuration = Math.max(...allResources.map((r) => r.duration_minutes), 0);
  const occupied = await listOccupiedReservations(supabase, businessId, localDate, maxDuration);

  const startMs = new Date(startsAt).getTime();
  const free = candidates.filter((resource) => isResourceFreeAt(resource, startMs, occupied));
  // Best-fit: smallest capacity that still fits, preferring the requested zone.
  return free.sort((a, b) => {
    if (zonePreference) {
      const aMatch = a.zone_name === zonePreference ? 0 : 1;
      const bMatch = b.zone_name === zonePreference ? 0 : 1;
      if (aMatch !== bMatch) return aMatch - bMatch;
    }
    return a.capacity - b.capacity;
  });
}

export function localSlotToUtcIso(localDate: string, hm: string): string {
  return new Date(localToUtcMs(localDate, `${hm}:00`)).toISOString();
}
