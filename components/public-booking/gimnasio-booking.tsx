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
import type { ClassInstanceWithSeats } from "@/lib/reservations/gimnasio-classes.server";
import {
  createPublicGimnasioReservation,
  fetchPublicClassInstances,
} from "@/app/reservar/[slug]/actions";
import { BookingSuccess } from "@/components/public-booking/booking-success";

export function PublicGimnasioBooking({
  slug,
  businessName,
  logoUrl,
}: {
  slug: string;
  businessName: string;
  logoUrl: string | null;
}) {
  const [localDate, setLocalDate] = useState(toLocalDateInputValue(new Date()));
  const [instances, setInstances] = useState<ClassInstanceWithSeats[]>([]);
  const [loadingInstances, setLoadingInstances] = useState(false);
  const [instanceId, setInstanceId] = useState("");
  const [mode, setMode] = useState<"punctual" | "recurring">("punctual");

  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [website, setWebsite] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [waitlisted, setWaitlisted] = useState(false);
  const [cancelUrl, setCancelUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoadingInstances(true);
    setInstanceId("");
    fetchPublicClassInstances(slug, localDate).then((result) => {
      if (!cancelled) {
        setInstances(result);
        setInstanceId(result[0]?.id ?? "");
        setLoadingInstances(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [slug, localDate]);

  const selectedInstance = instances.find((i) => i.id === instanceId);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setWaitlisted(false);

    if (!selectedInstance) {
      setError("Elegí una clase.");
      return;
    }

    setLoading(true);
    const result = await createPublicGimnasioReservation({
      slug,
      classInstanceId: selectedInstance.id,
      mode,
      customerName,
      customerPhone,
      customerEmail,
      website,
    });
    setLoading(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    if (result.classFull) {
      setWaitlisted(true);
      return;
    }

    setCancelUrl(result.cancelUrl ?? "");
  }

  if (cancelUrl !== null) {
    return <BookingSuccess businessName={businessName} />;
  }

  if (waitlisted) {
    return (
      <div className="mx-auto flex min-h-[70vh] max-w-md flex-col items-center justify-center gap-4 px-4 text-center">
        <h1 className="text-xl font-semibold">Ya no hay cupo en esta clase</h1>
        <p className="text-sm text-muted-foreground">
          Te anotamos en la lista de espera de <strong>{selectedInstance?.name}</strong>. Si se
          libera un lugar, te avisamos por email para que lo confirmes.
        </p>
      </div>
    );
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
          <Label>Clase</Label>
          {loadingInstances ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Buscando clases...
            </p>
          ) : instances.length === 0 ? (
            <p className="text-sm text-muted-foreground">No hay clases disponibles ese día.</p>
          ) : (
            <Select value={instanceId} onValueChange={setInstanceId}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {instances.map((instance) => (
                  <SelectItem key={instance.id} value={instance.id}>
                    {instance.name} — {new Date(instance.starts_at).toLocaleTimeString("es-AR", {
                      hour: "2-digit",
                      minute: "2-digit",
                      hour12: false,
                      timeZone: "America/Argentina/Buenos_Aires",
                    })}{" "}
                    ({instance.seats_taken}/{instance.capacity})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        <div className="space-y-1.5">
          <Label>Modalidad</Label>
          <Select value={mode} onValueChange={(v) => setMode(v as "punctual" | "recurring")}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="punctual">Puntual (solo esta fecha)</SelectItem>
              <SelectItem value="recurring">Recurrente (todas las semanas)</SelectItem>
            </SelectContent>
          </Select>
        </div>

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

        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}

        <Button type="submit" className="w-full" disabled={loading || !selectedInstance}>
          {loading && <Loader2 className="animate-spin" />}
          {loading ? "Reservando..." : "Confirmar reserva"}
        </Button>
      </form>
    </div>
  );
}
