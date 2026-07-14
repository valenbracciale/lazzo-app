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
import { Loader2 } from "lucide-react";
import { TimeWheelPicker, type TimeSlot } from "@/components/dashboard/time-wheel-picker";
import {
  createPublicRestaurantReservation,
  fetchPublicRestaurantResources,
  fetchPublicRestaurantSlots,
} from "@/app/reservar/[slug]/actions";
import { BookingSuccess } from "@/components/public-booking/booking-success";

const NO_ZONE = "__any__";
const NO_TABLE = "__none__";

type FreeResource = { id: string; name: string; capacity: number; zone_name: string | null };

export function PublicRestaurantBooking({
  slug,
  businessName,
  logoUrl,
  capacityMode,
  assignmentMode,
  maxPartySize,
  zoneNames,
}: {
  slug: string;
  businessName: string;
  logoUrl: string | null;
  capacityMode: "tables" | "zones";
  assignmentMode: "automatic" | "manual";
  maxPartySize: number;
  zoneNames: string[];
}) {
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [website, setWebsite] = useState("");
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
  const [cancelUrl, setCancelUrl] = useState<string | null>(null);

  const effectiveZonePreference =
    capacityMode === "zones" && zonePreference !== NO_ZONE ? zonePreference : null;

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoadingSlots(true);
    setSelectedSlot(null);

    const timeout = setTimeout(() => {
      fetchPublicRestaurantSlots({ slug, localDate, zonePreference: effectiveZonePreference }).then(
        (result) => {
          if (!cancelled) {
            setSlots(result);
            setLoadingSlots(false);
          }
        }
      );
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [slug, localDate, effectiveZonePreference]);

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
    fetchPublicRestaurantResources({
      slug,
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
  }, [slug, selectedSlot, assignmentMode, localDate, partySize, effectiveZonePreference, slots]);

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
    const result = await createPublicRestaurantReservation({
      slug,
      customerName,
      customerPhone,
      customerEmail,
      notes: notes || null,
      localDate,
      time: selectedSlot,
      dayOffset: slots.find((s) => s.time === selectedSlot)?.dayOffset ?? 0,
      partySize,
      zonePreference: effectiveZonePreference,
      resourceId: assignmentMode === "manual" ? selectedResourceId : undefined,
      website,
    });
    setLoading(false);

    if (result.error) {
      setError(result.error);
      setLoadingSlots(true);
      fetchPublicRestaurantSlots({ slug, localDate, zonePreference: effectiveZonePreference }).then((r) => {
        setSlots(r);
        setSelectedSlot(null);
        setLoadingSlots(false);
      });
      return;
    }

    setCancelUrl(result.cancelUrl ?? "");
  }

  if (cancelUrl !== null) {
    return <BookingSuccess businessName={businessName} />;
  }

  return (
    <div className="mx-auto max-w-lg space-y-6 px-4 py-10">
      <div className="space-y-1 text-center">
        {logoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoUrl} alt={businessName} className="mx-auto mb-2 h-16 w-auto object-contain" />
        )}
        <p className="text-sm text-muted-foreground">Reservar en</p>
        <h1 className="text-2xl font-bold">{businessName}</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 rounded-xl border p-6">
        <input
          type="text"
          name="website"
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
          tabIndex={-1}
          autoComplete="off"
          className="hidden"
          aria-hidden="true"
        />

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="customer_name">Nombre</Label>
            <Input id="customer_name" required value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="customer_phone">Teléfono</Label>
            <Input id="customer_phone" required value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="customer_email">Email</Label>
          <Input
            id="customer_email"
            type="email"
            required
            value={customerEmail}
            onChange={(e) => setCustomerEmail(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="date">Fecha</Label>
            <Input
              id="date"
              type="date"
              required
              min={toLocalDateInputValue(new Date())}
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
                      <SelectItem value={NO_TABLE}>Sin mesa asignada (nos encargamos después)</SelectItem>
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
                    Ninguna mesa libre tiene capacidad para {partySize} comensales. Podés reservar
                    igual: el negocio te asigna una mesa después.
                  </p>
                )}
              </>
            )}
          </div>
        )}

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

        <Button type="submit" className="w-full" disabled={loading || !selectedSlot}>
          {loading && <Loader2 className="animate-spin" />}
          {loading ? "Reservando..." : "Confirmar reserva"}
        </Button>
      </form>
    </div>
  );
}
