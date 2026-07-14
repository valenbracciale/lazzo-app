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
import { DialogFooter } from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";
import { TimeWheelPicker, type TimeSlot } from "@/components/dashboard/time-wheel-picker";
import {
  fetchAvailableSlots,
  fetchFreeResources,
  createRestaurantReservation,
} from "@/app/dashboard/reservations/actions";

const NO_ZONE = "__any__";
const NO_TABLE = "__none__";

type FreeResource = { id: string; name: string; capacity: number; zone_name: string | null };

export function RestaurantReservationForm({
  capacityMode,
  assignmentMode,
  maxPartySize,
  zoneNames,
  onSaved,
}: {
  capacityMode: "tables" | "zones";
  assignmentMode: "automatic" | "manual";
  maxPartySize: number;
  zoneNames: string[];
  onSaved: () => void;
}) {
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [localDate, setLocalDate] = useState(toLocalDateInputValue(new Date()));
  const [partySize, setPartySize] = useState(2);
  const [zonePreference, setZonePreference] = useState(NO_ZONE);

  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);

  const [freeResources, setFreeResources] = useState<FreeResource[]>([]);
  const [selectedResourceId, setSelectedResourceId] = useState<string | null>(null);
  const [loadingResources, setLoadingResources] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const effectiveZonePreference =
    capacityMode === "zones" && zonePreference !== NO_ZONE ? zonePreference : null;

  useEffect(() => {
    let cancelled = false;
    // Reset transient UI state before the debounced fetch below resolves -
    // safe, guarded by the `cancelled` flag against out-of-order responses.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoadingSlots(true);
    setSelectedSlot(null);

    const timeout = setTimeout(() => {
      fetchAvailableSlots({ localDate, zonePreference: effectiveZonePreference }).then((result) => {
        if (!cancelled) {
          setSlots(result);
          setLoadingSlots(false);
        }
      });
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [localDate, effectiveZonePreference]);

  useEffect(() => {
    if (!selectedSlot || assignmentMode !== "manual") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setFreeResources([]);
      setSelectedResourceId(null);
      return;
    }
    let cancelled = false;
    setLoadingResources(true);

    const dayOffset = slots.find((s) => s.time === selectedSlot)?.dayOffset ?? 0;
    fetchFreeResources({
      localDate,
      time: selectedSlot,
      dayOffset,
      partySize,
      zonePreference: effectiveZonePreference,
    }).then((result) => {
      if (!cancelled) {
        setFreeResources(result);
        const fitting = result.find((r) => r.capacity >= partySize);
        setSelectedResourceId(fitting?.id ?? null);
        setLoadingResources(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [selectedSlot, assignmentMode, localDate, partySize, effectiveZonePreference, slots]);

  const hasFittingResource = freeResources.some((r) => r.capacity >= partySize);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!selectedSlot) {
      setError("Elegí un horario disponible.");
      return;
    }
    if (partySize > maxPartySize) {
      setError(`El máximo de comensales por reserva es ${maxPartySize}.`);
      return;
    }
    if (assignmentMode === "manual" && hasFittingResource && !selectedResourceId) {
      setError("Elegí una mesa.");
      return;
    }

    setLoading(true);
    const { error: submitError } = await createRestaurantReservation({
      customerName,
      customerPhone,
      customerEmail: customerEmail || null,
      notes: notes || null,
      localDate,
      time: selectedSlot,
      dayOffset: slots.find((s) => s.time === selectedSlot)?.dayOffset ?? 0,
      partySize,
      zonePreference: effectiveZonePreference,
      resourceId: assignmentMode === "manual" ? selectedResourceId : undefined,
    });
    setLoading(false);

    if (submitError) {
      setError(submitError);
      // A lost race means the slot the customer picked is gone - refresh
      // availability instead of leaving a stale grid on screen.
      setLoadingSlots(true);
      fetchAvailableSlots({ localDate, zonePreference: effectiveZonePreference }).then((result) => {
        setSlots(result);
        setSelectedSlot(null);
        setLoadingSlots(false);
      });
      return;
    }

    onSaved();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="customer_name">Cliente</Label>
          <Input id="customer_name" required value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="customer_phone">Teléfono</Label>
          <Input id="customer_phone" required value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="date">Fecha</Label>
          <Input
            id="date"
            type="date"
            required
            value={localDate}
            onChange={(e) => setLocalDate(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="party_size">Comensales</Label>
          <Input
            id="party_size"
            type="number"
            min={1}
            max={maxPartySize}
            required
            value={partySize}
            onChange={(e) => setPartySize(Number(e.target.value) || 1)}
          />
        </div>
        {capacityMode === "zones" && (
          <div className="space-y-1.5">
            <Label>Zona preferida</Label>
            <Select value={zonePreference} onValueChange={setZonePreference}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_ZONE}>Cualquiera</SelectItem>
                {zoneNames.map((zone) => (
                  <SelectItem key={zone} value={zone}>
                    {zone}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
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
            <>
              <Select
                value={selectedResourceId ?? NO_TABLE}
                onValueChange={(value) => setSelectedResourceId(value === NO_TABLE ? null : value)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {!hasFittingResource && (
                    <SelectItem value={NO_TABLE}>Sin mesa asignada (asignar después)</SelectItem>
                  )}
                  {freeResources.map((resource) => (
                    <SelectItem key={resource.id} value={resource.id}>
                      {resource.name} ({resource.capacity} pers.)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!hasFittingResource && (
                <p className="text-xs text-muted-foreground">
                  Ninguna mesa libre tiene capacidad para {partySize} comensales. Podés dejarla sin
                  mesa y asignarla después (por ejemplo, combinando mesas).
                </p>
              )}
            </>
          )}
        </div>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="customer_email">Email (opcional)</Label>
        <Input
          id="customer_email"
          type="email"
          value={customerEmail}
          onChange={(e) => setCustomerEmail(e.target.value)}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="notes">Notas (opcional)</Label>
        <textarea
          id="notes"
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
        />
      </div>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      <DialogFooter>
        <Button type="submit" disabled={loading || !selectedSlot}>
          {loading && <Loader2 className="animate-spin" />}
          {loading ? "Guardando..." : "Crear reserva"}
        </Button>
      </DialogFooter>
    </form>
  );
}
