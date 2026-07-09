"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { createClient } from "@/lib/supabase/client";
import { syncNoShows } from "@/app/dashboard/reservations/actions";
import {
  formatLocalDateLabel,
  formatLocalTime,
  localDayRangeToUtc,
  shiftLocalDate,
  toLocalDateInputValue,
} from "@/lib/datetime";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { GimnasioClassEnrollmentForm } from "@/components/dashboard/gimnasio-class-enrollment-form";
import type { ClassInstanceWithSeats } from "@/lib/reservations/gimnasio-classes.server";
import { AlertTriangle, ChevronLeft, ChevronRight, Loader2, Plus } from "lucide-react";

type GimnasioReservation = {
  id: string;
  class_instance_id: string | null;
  starts_at: string;
  ends_at: string | null;
  arrived_at: string | null;
  no_show_at: string | null;
  no_show_acknowledged_at: string | null;
  status: "confirmed" | "en_curso" | "cancelled" | "completed" | "no_show";
  students: { name: string } | null;
  professionals: { name: string } | null;
  class_instances: { class_definitions: { name: string } | null } | null;
};

const statusLabel: Record<GimnasioReservation["status"], string> = {
  confirmed: "Confirmada",
  en_curso: "En curso",
  cancelled: "Cancelada",
  completed: "Completada",
  no_show: "No-show",
};

const statusVariant: Record<
  GimnasioReservation["status"],
  "default" | "secondary" | "destructive" | "outline"
> = {
  confirmed: "default",
  en_curso: "outline",
  cancelled: "destructive",
  completed: "secondary",
  no_show: "destructive",
};

function noopSubscribe() {
  return () => {};
}
function getTodaySnapshot() {
  return toLocalDateInputValue(new Date());
}
function getTodayServerSnapshot() {
  return null;
}

export function GimnasioReservationsView({
  businessId,
  isOwner,
  ownInstructorId,
}: {
  businessId: string;
  isOwner: boolean;
  ownInstructorId: string | null;
}) {
  const today = useSyncExternalStore(noopSubscribe, getTodaySnapshot, getTodayServerSnapshot);
  const [manualDate, setManualDate] = useState<string | null>(null);
  const selectedDate = manualDate ?? today;

  const [instances, setInstances] = useState<ClassInstanceWithSeats[]>([]);
  const [reservations, setReservations] = useState<GimnasioReservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [noShows, setNoShows] = useState<GimnasioReservation[]>([]);

  async function loadDay(localDate: string) {
    setLoading(true);
    const { start, end } = localDayRangeToUtc(localDate);
    const supabase = createClient();

    const [{ data: instanceRows }, { data: reservationRows }] = await Promise.all([
      supabase
        .from("class_instances")
        .select(
          "id, class_definition_id, starts_at, ends_at, capacity, instructor_id, class_definitions(name), professionals(name)"
        )
        .eq("business_id", businessId)
        .eq("status", "scheduled")
        .gte("starts_at", start)
        .lt("starts_at", end)
        .order("starts_at", { ascending: true }),
      supabase
        .from("reservations")
        .select("*, students(name), professionals(name), class_instances(class_definitions(name))")
        .eq("business_id", businessId)
        .gte("starts_at", start)
        .lt("starts_at", end)
        .not("class_instance_id", "is", null)
        .order("starts_at", { ascending: true }),
    ]);

    const seatsTaken = new Map<string, number>();
    for (const r of reservationRows ?? []) {
      if (r.status !== "confirmed" || !r.class_instance_id) continue;
      seatsTaken.set(r.class_instance_id, (seatsTaken.get(r.class_instance_id) ?? 0) + 1);
    }

    const rows = (instanceRows ?? []) as unknown as (Omit<ClassInstanceWithSeats, "name" | "instructor_name" | "seats_taken"> & {
      class_definitions: { name: string } | null;
      professionals: { name: string } | null;
    })[];

    return {
      instances: rows.map((i) => ({
        id: i.id,
        class_definition_id: i.class_definition_id,
        name: i.class_definitions?.name ?? "",
        starts_at: i.starts_at,
        ends_at: i.ends_at,
        capacity: i.capacity,
        instructor_id: i.instructor_id,
        instructor_name: i.professionals?.name ?? null,
        seats_taken: seatsTaken.get(i.id) ?? 0,
      })) as ClassInstanceWithSeats[],
      reservations: (reservationRows as unknown as GimnasioReservation[]) ?? [],
    };
  }

  async function loadNoShows() {
    const supabase = createClient();
    const { data } = await supabase
      .from("reservations")
      .select("*, students(name), professionals(name), class_instances(class_definitions(name))")
      .eq("business_id", businessId)
      .not("class_instance_id", "is", null)
      .not("no_show_at", "is", null)
      .is("no_show_acknowledged_at", null)
      .order("no_show_at", { ascending: false })
      .limit(20);
    return (data as unknown as GimnasioReservation[]) ?? [];
  }

  useEffect(() => {
    if (!selectedDate) return;
    let cancelled = false;

    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadDay(selectedDate).then(({ instances: i, reservations: r }) => {
      if (!cancelled) {
        setInstances(i);
        setReservations(r);
        setLoading(false);
      }
    });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate, businessId]);

  useEffect(() => {
    let cancelled = false;
    loadNoShows().then((data) => {
      if (!cancelled) setNoShows(data);
    });

    const interval = setInterval(async () => {
      const { flagged } = await syncNoShows(businessId);
      if (cancelled) return;
      if (flagged) {
        loadNoShows().then((data) => !cancelled && setNoShows(data));
        if (selectedDate) {
          loadDay(selectedDate).then(({ instances: i, reservations: r }) => {
            if (!cancelled) {
              setInstances(i);
              setReservations(r);
            }
          });
        }
      }
    }, 60_000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId]);

  function refetchAll() {
    if (selectedDate) {
      loadDay(selectedDate).then(({ instances: i, reservations: r }) => {
        setInstances(i);
        setReservations(r);
        setLoading(false);
      });
    }
    loadNoShows().then(setNoShows);
  }

  function handleSaved() {
    setDialogOpen(false);
    refetchAll();
  }

  async function acknowledgeNoShow(id: string) {
    const supabase = createClient();
    await supabase
      .from("reservations")
      .update({ no_show_acknowledged_at: new Date().toISOString() })
      .eq("id", id);
    refetchAll();
  }

  async function markArrived(id: string) {
    const supabase = createClient();
    await supabase.from("reservations").update({ arrived_at: new Date().toISOString() }).eq("id", id);
    refetchAll();
  }

  const visibleInstances = ownInstructorId
    ? instances.filter((i) => i.instructor_id === ownInstructorId)
    : instances;

  if (!selectedDate) {
    return null;
  }

  const isToday = selectedDate === toLocalDateInputValue(new Date());

  return (
    <div className="duration-300 animate-in fade-in-0 space-y-4">
      {noShows.length > 0 && (
        <div className="space-y-2 rounded-lg border border-destructive/50 bg-destructive/5 p-4">
          <p className="flex items-center gap-2 text-sm font-semibold text-destructive">
            <AlertTriangle className="size-4" />
            {noShows.length} alumno{noShows.length === 1 ? "" : "s"} marcado
            {noShows.length === 1 ? "" : "s"} como no-show
          </p>
          <ul className="space-y-1">
            {noShows.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-2 text-sm">
                <span>
                  {r.students?.name ?? "—"} — {formatLocalTime(r.starts_at)}
                  {r.class_instances?.class_definitions ? ` (${r.class_instances.class_definitions.name})` : ""}
                </span>
                <Button size="sm" variant="outline" onClick={() => acknowledgeNoShow(r.id)}>
                  Marcar como visto
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setManualDate(shiftLocalDate(selectedDate, -1))}
          >
            <ChevronLeft />
          </Button>
          <Input
            type="date"
            value={selectedDate}
            onChange={(e) => setManualDate(e.target.value)}
            className="w-auto"
          />
          <Button
            variant="outline"
            size="icon"
            onClick={() => setManualDate(shiftLocalDate(selectedDate, 1))}
          >
            <ChevronRight />
          </Button>
          {!isToday && (
            <Button variant="ghost" size="sm" onClick={() => setManualDate(toLocalDateInputValue(new Date()))}>
              Hoy
            </Button>
          )}
        </div>
        <Button onClick={() => setDialogOpen(true)} disabled={visibleInstances.length === 0}>
          <Plus />
          Nueva inscripción
        </Button>
      </div>

      <h2 className="text-lg font-semibold capitalize">
        {isOwner ? formatLocalDateLabel(selectedDate) : `Mi agenda — ${formatLocalDateLabel(selectedDate)}`}
      </h2>

      {visibleInstances.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {visibleInstances.map((i) => (
            <span key={i.id} className="rounded-md border px-2.5 py-1 text-xs text-muted-foreground">
              {i.name} · {formatLocalTime(i.starts_at)} · {i.instructor_name ?? "sin asignar"} ·{" "}
              {i.seats_taken}/{i.capacity}
            </span>
          ))}
        </div>
      )}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Hora</TableHead>
            <TableHead>Alumno</TableHead>
            <TableHead>Clase</TableHead>
            <TableHead>Profesor</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead>Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
            <TableRow>
              <TableCell colSpan={6} className="text-center text-muted-foreground">
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="size-4 animate-spin" />
                  Cargando...
                </span>
              </TableCell>
            </TableRow>
          ) : reservations.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="text-center text-muted-foreground">
                No hay inscripciones para este día.
              </TableCell>
            </TableRow>
          ) : (
            reservations.map((reservation) => (
              <TableRow key={reservation.id} className="duration-300 animate-in fade-in-0">
                <TableCell>
                  {formatLocalTime(reservation.starts_at)}
                  {reservation.ends_at ? ` – ${formatLocalTime(reservation.ends_at)}` : ""}
                </TableCell>
                <TableCell>{reservation.students?.name ?? "—"}</TableCell>
                <TableCell>{reservation.class_instances?.class_definitions?.name ?? "—"}</TableCell>
                <TableCell>{reservation.professionals?.name ?? "—"}</TableCell>
                <TableCell>
                  <Badge variant={statusVariant[reservation.status]}>
                    {statusLabel[reservation.status]}
                  </Badge>
                </TableCell>
                <TableCell>
                  {reservation.status === "confirmed" && isToday && !reservation.arrived_at && (
                    <Button size="sm" variant="outline" onClick={() => markArrived(reservation.id)}>
                      Marcar llegada
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nueva inscripción</DialogTitle>
          </DialogHeader>
          <GimnasioClassEnrollmentForm
            instances={visibleInstances}
            ownInstructorId={ownInstructorId}
            onSaved={handleSaved}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
