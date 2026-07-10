"use client";

import { useEffect, useState } from "react";
import { toLocalDateInputValue } from "@/lib/datetime";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";
import { TimeWheelPicker, type TimeSlot } from "@/components/dashboard/time-wheel-picker";
import {
  fetchAvailableSlots,
  fetchFreeResources,
  rescheduleRestaurantReservation,
} from "@/app/dashboard/reservations/actions";
import type { RestaurantReservation } from "@/components/dashboard/restaurant-reservations-view";

type FreeResource = { id: string; name: string; capacity: number; zone_name: string | null };

export function RestaurantRescheduleDialog({
  reservation,
  assignmentMode,
  onClose,
  onSaved,
}: {
  reservation: RestaurantReservation;
  assignmentMode: "automatic" | "manual";
  onClose: () => void;
  onSaved: () => void;
}) {
  const [localDate, setLocalDate] = useState(toLocalDateInputValue(new Date(reservation.starts_at)));
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);

  const [freeResources, setFreeResources] = useState<FreeResource[]>([]);
  const [selectedResourceId, setSelectedResourceId] = useState<string | null>(reservation.resource_id);
  const [loadingResources, setLoadingResources] = useState(false);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoadingSlots(true);
    fetchAvailableSlots({
      localDate,
      partySize: reservation.party_size,
      zonePreference: reservation.zone_preference,
      excludeReservationId: reservation.id,
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

  useEffect(() => {
    if (!selectedSlot || assignmentMode !== "manual") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setFreeResources([]);
      return;
    }
    let cancelled = false;
    setLoadingResources(true);
    fetchFreeResources({
      localDate,
      time: selectedSlot,
      partySize: reservation.party_size,
      zonePreference: reservation.zone_preference,
      excludeReservationId: reservation.id,
    }).then((result) => {
      if (!cancelled) {
        setFreeResources(result);
        if (!result.some((r) => r.id === selectedResourceId)) {
          setSelectedResourceId(result[0]?.id ?? null);
        }
        setLoadingResources(false);
      }
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSlot, localDate]);

  async function handleSave() {
    if (!selectedSlot) {
      setError("Elegí un horario disponible.");
      return;
    }
    if (assignmentMode === "manual" && !selectedResourceId) {
      setError("Elegí una mesa.");
      return;
    }

    setSaving(true);
    setError(null);

    const { error: updateError } = await rescheduleRestaurantReservation({
      reservationId: reservation.id,
      localDate,
      time: selectedSlot,
      partySize: reservation.party_size,
      zonePreference: reservation.zone_preference,
      resourceId: selectedResourceId,
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

          {assignmentMode === "manual" && selectedSlot && (
            <div className="space-y-1.5">
              <Label>Mesa</Label>
              {loadingResources ? (
                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" /> Buscando mesas libres...
                </p>
              ) : freeResources.length === 0 ? (
                <p className="text-sm text-muted-foreground">No hay mesas libres a ese horario.</p>
              ) : (
                <Select value={selectedResourceId ?? undefined} onValueChange={setSelectedResourceId}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {freeResources.map((resource) => (
                      <SelectItem key={resource.id} value={resource.id}>
                        {resource.name} ({resource.capacity} pers.)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          )}

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
