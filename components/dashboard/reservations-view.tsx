"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { createClient } from "@/lib/supabase/client";
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
import {
  ReservationForm,
  type Reservation,
  type Resource,
} from "@/components/dashboard/reservation-form";
import { ChevronLeft, ChevronRight, Loader2, Plus } from "lucide-react";

const statusLabel: Record<Reservation["status"], string> = {
  confirmed: "Confirmada",
  cancelled: "Cancelada",
  completed: "Completada",
};

const statusVariant: Record<Reservation["status"], "default" | "secondary" | "destructive"> = {
  confirmed: "default",
  cancelled: "destructive",
  completed: "secondary",
};

// "Today" can only be known client-side (the business's local timezone, not
// whatever timezone the server happens to run in) - useSyncExternalStore lets
// us return null during SSR and the real value once mounted, with no effect
// and no hydration-mismatch risk, unlike a manual "mounted" useState+useEffect.
function noopSubscribe() {
  return () => {};
}

function getTodaySnapshot() {
  return toLocalDateInputValue(new Date());
}

function getTodayServerSnapshot() {
  return null;
}

export function ReservationsView({
  businessId,
  resources,
}: {
  businessId: string;
  resources: Resource[];
}) {
  const today = useSyncExternalStore(noopSubscribe, getTodaySnapshot, getTodayServerSnapshot);
  const [manualDate, setManualDate] = useState<string | null>(null);
  const selectedDate = manualDate ?? today;

  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Reservation | null>(null);

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
    return (data as Reservation[]) ?? [];
  }

  useEffect(() => {
    if (!selectedDate) return;
    let cancelled = false;

    // No data-fetching library in this project; this is a plain
    // fetch-on-dependency-change effect with a cancellation guard against
    // out-of-order responses (e.g. quickly navigating between days).
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

  function openCreate() {
    setEditing(null);
    setDialogOpen(true);
  }

  function openEdit(reservation: Reservation) {
    setEditing(reservation);
    setDialogOpen(true);
  }

  function handleSaved() {
    setDialogOpen(false);
    if (selectedDate) {
      loadReservations(selectedDate).then((data) => {
        setReservations(data);
        setLoading(false);
      });
    }
  }

  const resourceName = (id: string | null) =>
    id ? resources.find((r) => r.id === id)?.name ?? "—" : "—";

  if (!selectedDate) {
    return null;
  }

  const isToday = selectedDate === toLocalDateInputValue(new Date());

  return (
    <div className="duration-300 animate-in fade-in-0 space-y-4">
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
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setManualDate(toLocalDateInputValue(new Date()))}
            >
              Hoy
            </Button>
          )}
        </div>
        <Button onClick={openCreate}>
          <Plus />
          Nueva reserva
        </Button>
      </div>

      <h2 className="text-lg font-semibold capitalize">
        {formatLocalDateLabel(selectedDate)}
      </h2>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Hora</TableHead>
            <TableHead>Cliente</TableHead>
            <TableHead>Teléfono</TableHead>
            <TableHead>Recurso</TableHead>
            <TableHead>Estado</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
            <TableRow>
              <TableCell colSpan={5} className="text-center text-muted-foreground">
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="size-4 animate-spin" />
                  Cargando...
                </span>
              </TableCell>
            </TableRow>
          ) : reservations.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="text-center text-muted-foreground">
                No hay reservas para este día.
              </TableCell>
            </TableRow>
          ) : (
            reservations.map((reservation) => (
              <TableRow
                key={reservation.id}
                className="cursor-pointer duration-300 animate-in fade-in-0"
                onClick={() => openEdit(reservation)}
              >
                <TableCell>
                  {formatLocalTime(reservation.starts_at)}
                  {reservation.ends_at ? ` – ${formatLocalTime(reservation.ends_at)}` : ""}
                </TableCell>
                <TableCell>{reservation.customer_name}</TableCell>
                <TableCell>{reservation.customer_phone}</TableCell>
                <TableCell>{resourceName(reservation.resource_id)}</TableCell>
                <TableCell>
                  <Badge variant={statusVariant[reservation.status]}>
                    {statusLabel[reservation.status]}
                  </Badge>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Editar reserva" : "Nueva reserva"}</DialogTitle>
          </DialogHeader>
          <ReservationForm
            businessId={businessId}
            resources={resources}
            reservation={editing}
            onSaved={handleSaved}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
