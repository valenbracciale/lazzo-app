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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  PeluqueriaReservationForm,
  type PeluqueriaService,
} from "@/components/dashboard/peluqueria-reservation-form";
import { PeluqueriaRescheduleDialog } from "@/components/dashboard/peluqueria-reschedule-dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Pencil,
  Plus,
  StickyNote,
} from "lucide-react";

const ALL_PROFESSIONALS = "__all__";

export type PeluqueriaProfessional = { id: string; name: string };

export type PeluqueriaReservation = {
  id: string;
  customer_name: string;
  customer_phone: string;
  starts_at: string;
  ends_at: string | null;
  arrived_at: string | null;
  no_show_at: string | null;
  no_show_acknowledged_at: string | null;
  status: "confirmed" | "en_curso" | "cancelled" | "completed" | "no_show";
  service_id: string | null;
  professional_id: string | null;
  notes: string | null;
  services: { name: string } | null;
  professionals: { name: string } | null;
};

const statusLabel: Record<PeluqueriaReservation["status"], string> = {
  confirmed: "Confirmada",
  en_curso: "En curso",
  cancelled: "Cancelada",
  completed: "Completada",
  no_show: "No-show",
};

const statusVariant: Record<
  PeluqueriaReservation["status"],
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

export function PeluqueriaReservationsView({
  businessId,
  services,
  professionals,
  isOwner,
}: {
  businessId: string;
  services: PeluqueriaService[];
  professionals: PeluqueriaProfessional[];
  isOwner: boolean;
}) {
  const today = useSyncExternalStore(noopSubscribe, getTodaySnapshot, getTodayServerSnapshot);
  const [manualDate, setManualDate] = useState<string | null>(null);
  const selectedDate = manualDate ?? today;
  const [professionalFilter, setProfessionalFilter] = useState(ALL_PROFESSIONALS);

  const [reservations, setReservations] = useState<PeluqueriaReservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [noShows, setNoShows] = useState<PeluqueriaReservation[]>([]);
  const [rescheduling, setRescheduling] = useState<PeluqueriaReservation | null>(null);

  async function loadReservations(localDate: string) {
    setLoading(true);
    const { start, end } = localDayRangeToUtc(localDate);
    const supabase = createClient();
    let query = supabase
      .from("reservations")
      .select("*, services(name), professionals(name)")
      .eq("business_id", businessId)
      .gte("starts_at", start)
      .lt("starts_at", end)
      .order("starts_at", { ascending: true });

    if (isOwner && professionalFilter !== ALL_PROFESSIONALS) {
      query = query.eq("professional_id", professionalFilter);
    }

    const { data } = await query;
    return (data as unknown as PeluqueriaReservation[]) ?? [];
  }

  async function loadNoShows() {
    const supabase = createClient();
    const { data } = await supabase
      .from("reservations")
      .select("*, services(name), professionals(name)")
      .eq("business_id", businessId)
      .not("no_show_at", "is", null)
      .is("no_show_acknowledged_at", null)
      .order("no_show_at", { ascending: false })
      .limit(20);
    return (data as unknown as PeluqueriaReservation[]) ?? [];
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
  }, [selectedDate, businessId, professionalFilter]);

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
    await supabase
      .from("reservations")
      .update({ arrived_at: new Date().toISOString(), status: "en_curso" })
      .eq("id", id);
    refetchAll();
  }

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
            {noShows.length} reserva{noShows.length === 1 ? "" : "s"} marcada
            {noShows.length === 1 ? "" : "s"} como no-show
          </p>
          <ul className="space-y-1">
            {noShows.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-2 text-sm">
                <span>
                  {r.customer_name} — {formatLocalTime(r.starts_at)}
                  {r.professionals ? ` (${r.professionals.name})` : ""}
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
          {isOwner && (
            <Select value={professionalFilter} onValueChange={setProfessionalFilter}>
              <SelectTrigger className="w-auto">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_PROFESSIONALS}>Todos</SelectItem>
                {professionals.map((professional) => (
                  <SelectItem key={professional.id} value={professional.id}>
                    {professional.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus />
          Nueva reserva
        </Button>
      </div>

      <h2 className="text-lg font-semibold capitalize">
        {isOwner ? formatLocalDateLabel(selectedDate) : `Mi agenda — ${formatLocalDateLabel(selectedDate)}`}
      </h2>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Hora</TableHead>
            <TableHead>Cliente</TableHead>
            <TableHead>Servicio</TableHead>
            <TableHead>Profesional</TableHead>
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
                No hay turnos para este día.
              </TableCell>
            </TableRow>
          ) : (
            reservations.map((reservation) => (
              <TableRow key={reservation.id} className="duration-300 animate-in fade-in-0">
                <TableCell>
                  {formatLocalTime(reservation.starts_at)}
                  {reservation.ends_at ? ` – ${formatLocalTime(reservation.ends_at)}` : ""}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1.5">
                    <span>{reservation.customer_name}</span>
                    {reservation.notes && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span tabIndex={0} className="inline-flex cursor-help text-muted-foreground">
                            <StickyNote className="size-3.5" aria-label="Tiene notas" />
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>{reservation.notes}</TooltipContent>
                      </Tooltip>
                    )}
                  </div>
                </TableCell>
                <TableCell>{reservation.services?.name ?? "—"}</TableCell>
                <TableCell>{reservation.professionals?.name ?? "—"}</TableCell>
                <TableCell>
                  <Badge variant={statusVariant[reservation.status]}>
                    {statusLabel[reservation.status]}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex gap-2">
                    {reservation.status === "confirmed" && isToday && !reservation.arrived_at && (
                      <Button size="sm" variant="outline" onClick={() => markArrived(reservation.id)}>
                        Marcar llegada
                      </Button>
                    )}
                    {(reservation.status === "confirmed" || reservation.status === "en_curso") && (
                      <Button size="sm" variant="ghost" onClick={() => setRescheduling(reservation)}>
                        <Pencil /> Editar horario
                      </Button>
                    )}
                  </div>
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
          <PeluqueriaReservationForm
            services={services}
            isEncargado={!isOwner}
            onSaved={handleSaved}
          />
        </DialogContent>
      </Dialog>

      {rescheduling && (
        <PeluqueriaRescheduleDialog
          reservation={rescheduling}
          onClose={() => setRescheduling(null)}
          onSaved={() => {
            setRescheduling(null);
            refetchAll();
          }}
        />
      )}
    </div>
  );
}
