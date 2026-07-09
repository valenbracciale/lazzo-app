"use client";

import { useEffect, useState } from "react";
import { toLocalDateInputValue } from "@/lib/datetime";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";
import { TimeWheelPicker, type TimeSlot } from "@/components/dashboard/time-wheel-picker";
import {
  fetchAvailableSlotsForService,
  reschedulePeluqueriaReservation,
} from "@/app/dashboard/reservations/peluqueria-actions";
import type { PeluqueriaReservation } from "@/components/dashboard/peluqueria-reservations-view";

export function PeluqueriaRescheduleDialog({
  reservation,
  onClose,
  onSaved,
}: {
  reservation: PeluqueriaReservation;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [localDate, setLocalDate] = useState(toLocalDateInputValue(new Date(reservation.starts_at)));
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!reservation.service_id) return;
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoadingSlots(true);
    fetchAvailableSlotsForService({
      serviceId: reservation.service_id,
      localDate,
      professionalId: reservation.professional_id,
    }).then((result) => {
      if (!cancelled) {
        setSlots(result);
        setLoadingSlots(false);
      }
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localDate]);

  async function handleSave() {
    if (!selectedSlot || !reservation.service_id) {
      setError("Elegí un horario disponible.");
      return;
    }

    setSaving(true);
    setError(null);

    const { error: updateError } = await reschedulePeluqueriaReservation({
      reservationId: reservation.id,
      serviceId: reservation.service_id,
      localDate,
      time: selectedSlot,
      professionalId: reservation.professional_id,
    });

    setSaving(false);
    if (updateError) {
      setError(updateError);
      return;
    }

    onSaved();
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar horario — {reservation.customer_name}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="reschedule_date">Fecha</Label>
            <Input
              id="reschedule_date"
              type="date"
              value={localDate}
              onChange={(e) => {
                setLocalDate(e.target.value);
                setSelectedSlot(null);
              }}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Horario</Label>
            <TimeWheelPicker slots={slots} value={selectedSlot} onChange={setSelectedSlot} loading={loadingSlots} />
          </div>

          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving || !selectedSlot}>
            {saving && <Loader2 className="animate-spin" />}
            {saving ? "Guardando..." : "Guardar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
