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
import { RestaurantReservationForm } from "@/components/dashboard/restaurant-reservation-form";
import { AlertTriangle, ChevronLeft, ChevronRight, Loader2, Plus } from "lucide-react";

export type RestaurantResource = {
  id: string;
  name: string;
  capacity: number;
  zone_name: string | null;
  duration_minutes: number;
};

export type RestaurantShift = {
  id: string;
  name: string;
  days_of_week: number[];
  start_time: string;
  end_time: string;
};

export type RestaurantReservation = {
  id: string;
  resource_id: string | null;
  customer_name: string;
  customer_phone: string;
  customer_email: string | null;
  notes: string | null;
  party_size: number;
  zone_preference: string | null;
  starts_at: string;
  ends_at: string | null;
  arrived_at: string | null;
  released_at: string | null;
  no_show_at: string | null;
  no_show_acknowledged_at: string | null;
  status: "confirmed" | "cancelled" | "completed" | "no_show";
};

const statusLabel: Record<RestaurantReservation["status"], string> = {
  confirmed: "Confirmada",
  cancelled: "Cancelada",
  completed: "Completada",
  no_show: "No-show",
};

const statusVariant: Record<
  RestaurantReservation["status"],
  "default" | "secondary" | "destructive"
> = {
  confirmed: "default",
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

function currentLocalHm(): string {
  const now = new Date();
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}

function findActiveShift(shifts: RestaurantShift[]): RestaurantShift | null {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const hm = currentLocalHm();
  return (
    shifts.find(
      (s) => s.days_of_week.includes(dayOfWeek) && hm >= s.start_time.slice(0, 5) && hm < s.end_time.slice(0, 5)
    ) ?? null
  );
}

export function RestaurantReservationsView({
  businessId,
  resources,
  shifts,
  capacityMode,
  assignmentMode,
}: {
  businessId: string;
  resources: RestaurantResource[];
  shifts: RestaurantShift[];
  capacityMode: "tables" | "zones";
  assignmentMode: "automatic" | "manual";
}) {
  const today = useSyncExternalStore(noopSubscribe, getTodaySnapshot, getTodayServerSnapshot);
  const [manualDate, setManualDate] = useState<string | null>(null);
  const selectedDate = manualDate ?? today;

  const [reservations, setReservations] = useState<RestaurantReservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [noShows, setNoShows] = useState<RestaurantReservation[]>([]);

  async function loadReservations(localDate: string) {
    setLoading(true);
    const { start, end } = localDayRangeToUtc(localDate);
    const supabase = createClient();
    const { data } = await supabase
      .from("reservations")
      .select("*")
      .eq("business_id", businessId)
      .gte("starts_at", start)
      .lt("starts_at", end)
      .order("starts_at", { ascending: true });
    return (data as RestaurantReservation[]) ?? [];
  }

  async function loadNoShows() {
    const supabase = createClient();
    const { data } = await supabase
      .from("reservations")
      .select("*")
      .eq("business_id", businessId)
      .not("no_show_at", "is", null)
      .is("no_show_acknowledged_at", null)
      .order("no_show_at", { ascending: false })
      .limit(20);
    return (data as RestaurantReservation[]) ?? [];
  }

  useEffect(() => {
    if (!selectedDate) return;
    let cancelled = false;

    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadReservations(selectedDate).then((data) => {
      if (!cancelled) {
        setReservations(data);
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
          loadReservations(selectedDate).then((data) => !cancelled && setReservations(data));
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
      loadReservations(selectedDate).then((data) => {
        setReservations(data);
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

  async function releaseResource(id: string) {
    const supabase = createClient();
    await supabase
      .from("reservations")
      .update({ released_at: new Date().toISOString(), status: "completed" })
      .eq("id", id);
    refetchAll();
  }

  const resourceName = (id: string | null) =>
    id ? resources.find((r) => r.id === id)?.name ?? "—" : "—";

  const zoneNames = Array.from(
    new Set(resources.map((r) => r.zone_name).filter((z): z is string => !!z))
  );

  if (!selectedDate) {
    return null;
  }

  const isToday = selectedDate === toLocalDateInputValue(new Date());
  const activeShift = isToday ? findActiveShift(shifts) : null;
  const totalCapacity = resources.reduce((sum, r) => sum + r.capacity, 0);
  const occupiedCovers = activeShift
    ? reservations
        .filter((r) => {
          if (r.status !== "confirmed") return false;
          const now = new Date();
          const start = new Date(r.starts_at);
          const end = new Date(r.released_at ?? r.ends_at ?? r.starts_at);
          return start <= now && now < end;
        })
        .reduce((sum, r) => sum + r.party_size, 0)
    : 0;

  return (
    <div className="duration-300 animate-in fade-in-0 space-y-4">
      {noShows.length > 0 && (
        <div className="space-y-2 rounded-lg border border-destructive/50 bg-destructive/5 p-4">
          <p className="flex items-center gap-2 text-sm font-semibold text-destructive">
            <AlertTriangle className="size-4" />
            {noShows.length} reserva{noShows.length === 1 ? "" : "s"} marcada
            {noShows.length === 1 ? "" : "s"} como no-show
          </p>
          <ul className="space-y-1">
            {noShows.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-2 text-sm">
                <span>
                  {r.customer_name} — {formatLocalTime(r.starts_at)}
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
        <Button onClick={() => setDialogOpen(true)}>
          <Plus />
          Nueva reserva
        </Button>
      </div>

      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold capitalize">{formatLocalDateLabel(selectedDate)}</h2>
        {isToday && (
          <Badge variant={activeShift ? "default" : "secondary"}>
            {activeShift ? `${activeShift.name}: ${occupiedCovers}/${totalCapacity} cubiertos` : "Fuera de turno"}
          </Badge>
        )}
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Hora</TableHead>
            <TableHead>Cliente</TableHead>
            <TableHead>Comensales</TableHead>
            <TableHead>Mesa</TableHead>
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
                No hay reservas para este día.
              </TableCell>
            </TableRow>
          ) : (
            reservations.map((reservation) => (
              <TableRow key={reservation.id} className="duration-300 animate-in fade-in-0">
                <TableCell>
                  {formatLocalTime(reservation.starts_at)}
                  {reservation.ends_at ? ` – ${formatLocalTime(reservation.ends_at)}` : ""}
                </TableCell>
                <TableCell>{reservation.customer_name}</TableCell>
                <TableCell>{reservation.party_size}</TableCell>
                <TableCell>{resourceName(reservation.resource_id)}</TableCell>
                <TableCell>
                  <Badge variant={statusVariant[reservation.status]}>
                    {statusLabel[reservation.status]}
                  </Badge>
                </TableCell>
                <TableCell>
                  {reservation.status === "confirmed" && isToday && (
                    <div className="flex gap-2">
                      {!reservation.arrived_at && (
                        <Button size="sm" variant="outline" onClick={() => markArrived(reservation.id)}>
                          Marcar llegada
                        </Button>
                      )}
                      <Button size="sm" variant="outline" onClick={() => releaseResource(reservation.id)}>
                        Liberar mesa
                      </Button>
                    </div>
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
            <DialogTitle>Nueva reserva</DialogTitle>
          </DialogHeader>
          <RestaurantReservationForm
            capacityMode={capacityMode}
            assignmentMode={assignmentMode}
            zoneNames={zoneNames}
            onSaved={handleSaved}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
