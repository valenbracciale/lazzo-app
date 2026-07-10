import type { createClient } from "@/lib/supabase/server";
import { localToUtcMs } from "@/lib/reservations/availability.server";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export type ClassDefinition = {
  id: string;
  name: string;
  days_of_week: number[];
  start_time: string;
  duration_minutes: number;
  capacity: number;
  instructor_id: string | null;
};

export type ClassInstanceWithSeats = {
  id: string;
  class_definition_id: string;
  name: string;
  starts_at: string;
  ends_at: string;
  capacity: number;
  instructor_id: string | null;
  instructor_name: string | null;
  seats_taken: number;
};

export async function listClassDefinitions(
  supabase: Supabase,
  businessId: string
): Promise<ClassDefinition[]> {
  const { data } = await supabase
    .from("class_definitions")
    .select("id, name, days_of_week, start_time, duration_minutes, capacity, instructor_id")
    .eq("business_id", businessId)
    .order("name", { ascending: true });

  return (data ?? []) as ClassDefinition[];
}

export async function listClassInstancesForDate(
  supabase: Supabase,
  businessId: string,
  localDate: string
): Promise<ClassInstanceWithSeats[]> {
  const dayStartMs = localToUtcMs(localDate, "00:00");
  const dayEndMs = dayStartMs + 24 * 60 * 60_000;

  const { data: instances } = await supabase
    .from("class_instances")
    .select(
      "id, class_definition_id, starts_at, ends_at, capacity, instructor_id, class_definitions(name), professionals(name)"
    )
    .eq("business_id", businessId)
    .eq("status", "scheduled")
    .gte("starts_at", new Date(dayStartMs).toISOString())
    .lt("starts_at", new Date(dayEndMs).toISOString())
    .order("starts_at", { ascending: true });

  const rows = instances ?? [];
  const instanceIds = rows.map((i) => i.id);

  const { data: confirmed } =
    instanceIds.length > 0
      ? await supabase
          .from("reservations")
          .select("class_instance_id")
          .in("class_instance_id", instanceIds)
          .in("status", ["confirmed", "en_curso"])
      : { data: [] as { class_instance_id: string | null }[] };

  const seatsTaken = new Map<string, number>();
  for (const row of confirmed ?? []) {
    if (!row.class_instance_id) continue;
    seatsTaken.set(row.class_instance_id, (seatsTaken.get(row.class_instance_id) ?? 0) + 1);
  }

  return rows.map((i) => ({
    id: i.id,
    class_definition_id: i.class_definition_id,
    name: (i.class_definitions as unknown as { name: string } | null)?.name ?? "",
    starts_at: i.starts_at,
    ends_at: i.ends_at,
    capacity: i.capacity,
    instructor_id: i.instructor_id,
    instructor_name: (i.professionals as unknown as { name: string } | null)?.name ?? null,
    seats_taken: seatsTaken.get(i.id) ?? 0,
  }));
}
