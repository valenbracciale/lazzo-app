import { createClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;

function toHm(time: string): string {
  return time.slice(0, 5);
}

export async function getRestaurantConfigSnapshot(
  supabase: Supabase,
  businessId: string
) {
  const [{ data: resources }, { data: shifts }, { data: settings }] =
    await Promise.all([
      supabase
        .from("resources")
        .select("id, name, capacity, zone_name, duration_minutes")
        .eq("business_id", businessId)
        .order("name", { ascending: true }),
      supabase
        .from("shifts")
        .select("name, days_of_week, start_time, end_time")
        .eq("business_id", businessId),
      supabase
        .from("reservation_settings")
        .select("capacity_mode, assignment_mode, max_party_size")
        .eq("business_id", businessId)
        .maybeSingle(),
    ]);

  const capacityMode = settings?.capacity_mode ?? "tables";
  const durations: Record<number, number> = {};
  for (const r of resources ?? []) {
    durations[r.capacity] = r.duration_minutes;
  }

  let tables: { id: string; name: string; capacity: number }[] = [];
  let zones: { zoneName: string; tableSize: number; tableCount: number }[] = [];

  if (capacityMode === "zones") {
    const zoneMap = new Map<
      string,
      { zoneName: string; tableSize: number; tableCount: number }
    >();
    for (const r of resources ?? []) {
      const key = `${r.zone_name ?? ""}::${r.capacity}`;
      const existing = zoneMap.get(key);
      if (existing) {
        existing.tableCount += 1;
      } else {
        zoneMap.set(key, {
          zoneName: r.zone_name ?? "",
          tableSize: r.capacity,
          tableCount: 1,
        });
      }
    }
    zones = Array.from(zoneMap.values());
  } else {
    tables = (resources ?? []).map((r) => ({ id: r.id, name: r.name, capacity: r.capacity }));
  }

  return {
    capacityMode: capacityMode as "tables" | "zones",
    tables,
    zones,
    durations,
    shifts: (shifts ?? []).map((s) => ({
      name: s.name,
      daysOfWeek: s.days_of_week ?? [],
      startTime: toHm(s.start_time),
      endTime: toHm(s.end_time),
    })),
    assignmentMode: (settings?.assignment_mode ?? "automatic") as
      | "automatic"
      | "manual",
    maxPartySize: settings?.max_party_size ?? 20,
  };
}

export async function getPeluqueriaConfigSnapshot(
  supabase: Supabase,
  businessId: string
) {
  const [{ data: services }, { data: allShifts }, { data: professionals }] =
    await Promise.all([
      supabase
        .from("services")
        .select("id, name, duration_minutes")
        .eq("business_id", businessId)
        .order("name", { ascending: true }),
      supabase
        .from("shifts")
        .select("professional_id, name, days_of_week, start_time, end_time")
        .eq("business_id", businessId),
      supabase
        .from("professionals")
        .select("id, name")
        .eq("business_id", businessId)
        .order("name", { ascending: true }),
    ]);

  const professionalIds = (professionals ?? []).map((p) => p.id);
  const { data: profServices } = professionalIds.length
    ? await supabase
        .from("professional_services")
        .select("professional_id, service_id")
        .in("professional_id", professionalIds)
    : { data: [] as { professional_id: string; service_id: string }[] };

  const shiftsByProfessional = new Map<
    string,
    { name: string; daysOfWeek: number[]; startTime: string; endTime: string }[]
  >();
  const generalShifts: {
    name: string;
    daysOfWeek: number[];
    startTime: string;
    endTime: string;
  }[] = [];
  for (const s of allShifts ?? []) {
    const row = {
      name: s.name,
      daysOfWeek: s.days_of_week ?? [],
      startTime: toHm(s.start_time),
      endTime: toHm(s.end_time),
    };
    if (!s.professional_id) {
      generalShifts.push(row);
      continue;
    }
    const list = shiftsByProfessional.get(s.professional_id) ?? [];
    list.push(row);
    shiftsByProfessional.set(s.professional_id, list);
  }

  const serviceIdsByProfessional = new Map<string, string[]>();
  for (const ps of profServices ?? []) {
    const list = serviceIdsByProfessional.get(ps.professional_id) ?? [];
    list.push(ps.service_id);
    serviceIdsByProfessional.set(ps.professional_id, list);
  }

  const serviceAssignments: Record<string, string[]> = {};
  for (const p of professionals ?? []) {
    serviceAssignments[p.id] = serviceIdsByProfessional.get(p.id) ?? [];
  }

  return {
    services: (services ?? []).map((s) => ({
      id: s.id,
      name: s.name,
      durationMinutes: s.duration_minutes,
    })),
    generalShifts,
    professionals: (professionals ?? []).map((p) => {
      const ownShifts = shiftsByProfessional.get(p.id) ?? [];
      return {
        id: p.id,
        name: p.name,
        hasCustomSchedule: ownShifts.length > 0,
        shifts: ownShifts,
      };
    }),
    serviceAssignments,
  };
}

export async function getGimnasioConfigSnapshot(
  supabase: Supabase,
  businessId: string
) {
  const [{ data: classDefs }, { data: instructors }] = await Promise.all([
    supabase
      .from("class_definitions")
      .select(
        "id, name, days_of_week, start_time, duration_minutes, capacity, instructor_id"
      )
      .eq("business_id", businessId)
      .order("name", { ascending: true }),
    supabase
      .from("professionals")
      .select("id, name")
      .eq("business_id", businessId)
      .order("name", { ascending: true }),
  ]);

  const instructorAssignments: Record<string, string> = {};
  for (const c of classDefs ?? []) {
    if (c.instructor_id) instructorAssignments[c.id] = c.instructor_id;
  }

  return {
    classes: (classDefs ?? []).map((c) => ({
      id: c.id,
      name: c.name,
      daysOfWeek: c.days_of_week ?? [],
      startTime: toHm(c.start_time),
      durationMinutes: c.duration_minutes,
      capacity: c.capacity,
    })),
    instructors: (instructors ?? []).map((i) => ({ id: i.id, name: i.name })),
    instructorAssignments,
  };
}
