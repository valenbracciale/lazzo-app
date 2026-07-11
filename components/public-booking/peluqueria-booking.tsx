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
  createPublicPeluqueriaReservation,
  fetchPublicEligibleProfessionals,
  fetchPublicPeluqueriaSlots,
} from "@/app/reservar/[slug]/actions";
import { BookingSuccess } from "@/components/public-booking/booking-success";

const AUTO_PROFESSIONAL = "__auto__";

type Service = { id: string; name: string; duration_minutes: number };
type Professional = { id: string; name: string };

export function PublicPeluqueriaBooking({
  slug,
  businessName,
  services,
}: {
  slug: string;
  businessName: string;
  services: Service[];
}) {
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [website, setWebsite] = useState("");
  const [serviceId, setServiceId] = useState(services[0]?.id ?? "");
  const [localDate, setLocalDate] = useState(toLocalDateInputValue(new Date()));
  const [professionalId, setProfessionalId] = useState(AUTO_PROFESSIONAL);

  const [eligibleProfessionals, setEligibleProfessionals] = useState<Professional[]>([]);
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cancelUrl, setCancelUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!serviceId) return;
    let cancelled = false;
    fetchPublicEligibleProfessionals(slug, serviceId).then((result) => {
      if (!cancelled) setEligibleProfessionals(result);
    });
    return () => {
      cancelled = true;
    };
  }, [slug, serviceId]);

  useEffect(() => {
    if (!serviceId) return;
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoadingSlots(true);
    setSelectedSlot(null);

    const timeout = setTimeout(() => {
      fetchPublicPeluqueriaSlots({
        slug,
        serviceId,
        localDate,
        professionalId: professionalId !== AUTO_PROFESSIONAL ? professionalId : null,
      }).then((result) => {
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
  }, [slug, serviceId, localDate, professionalId]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!selectedSlot) {
      setError("Elegí un horario disponible.");
      return;
    }

    setLoading(true);
    const result = await createPublicPeluqueriaReservation({
      slug,
      customerName,
      customerPhone,
      customerEmail,
      notes: notes || null,
      serviceId,
      localDate,
      time: selectedSlot,
      dayOffset: slots.find((s) => s.time === selectedSlot)?.dayOffset ?? 0,
      professionalId: professionalId !== AUTO_PROFESSIONAL ? professionalId : null,
      website,
    });
    setLoading(false);

    if (result.error) {
      setError(result.error);
      setLoadingSlots(true);
      fetchPublicPeluqueriaSlots({
        slug,
        serviceId,
        localDate,
        professionalId: professionalId !== AUTO_PROFESSIONAL ? professionalId : null,
      }).then((r) => {
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

  if (services.length === 0) {
    return (
      <div className="mx-auto max-w-lg px-4 py-10 text-center text-muted-foreground">
        Este negocio todavía no tiene servicios disponibles para reservar online.
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg space-y-6 px-4 py-10">
      <div className="space-y-1 text-center">
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

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Servicio</Label>
            <Select value={serviceId} onValueChange={setServiceId}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {services.map((service) => (
                  <SelectItem key={service.id} value={service.id}>
                    {service.name} ({service.duration_minutes} min)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
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
        </div>

        <div className="space-y-1.5">
          <Label>Profesional</Label>
          <Select value={professionalId} onValueChange={setProfessionalId}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={AUTO_PROFESSIONAL}>Cualquiera disponible</SelectItem>
              {eligibleProfessionals.map((professional) => (
                <SelectItem key={professional.id} value={professional.id}>
                  {professional.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label>Horario</Label>
          <TimeWheelPicker slots={slots} value={selectedSlot} onChange={setSelectedSlot} loading={loadingSlots} />
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

        <Button type="submit" className="w-full" disabled={loading || !selectedSlot}>
          {loading && <Loader2 className="animate-spin" />}
          {loading ? "Reservando..." : "Confirmar reserva"}
        </Button>
      </form>
    </div>
  );
}
