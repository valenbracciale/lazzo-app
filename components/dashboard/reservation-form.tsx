"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { toLocalDatetimeInputValue } from "@/lib/datetime";
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

export type Resource = { id: string; name: string };

export type Reservation = {
  id: string;
  resource_id: string | null;
  customer_name: string;
  customer_phone: string;
  customer_email: string | null;
  notes: string | null;
  starts_at: string;
  ends_at: string | null;
  status: "confirmed" | "cancelled" | "completed";
};

const NO_RESOURCE = "__none__";

export function ReservationForm({
  businessId,
  resources,
  reservation,
  onSaved,
}: {
  businessId: string;
  resources: Resource[];
  reservation?: Reservation | null;
  onSaved: () => void;
}) {
  const isEdit = !!reservation;

  const [customerName, setCustomerName] = useState(reservation?.customer_name ?? "");
  const [customerPhone, setCustomerPhone] = useState(reservation?.customer_phone ?? "");
  const [customerEmail, setCustomerEmail] = useState(reservation?.customer_email ?? "");
  const [notes, setNotes] = useState(reservation?.notes ?? "");
  const [startsAt, setStartsAt] = useState(
    reservation ? toLocalDatetimeInputValue(reservation.starts_at) : ""
  );
  const [endsAt, setEndsAt] = useState(
    reservation?.ends_at ? toLocalDatetimeInputValue(reservation.ends_at) : ""
  );
  const [resourceId, setResourceId] = useState(reservation?.resource_id ?? NO_RESOURCE);
  const [status, setStatus] = useState(reservation?.status ?? "confirmed");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const startsAtIso = new Date(startsAt).toISOString();
    const endsAtIso = endsAt ? new Date(endsAt).toISOString() : null;

    if (endsAtIso && endsAtIso <= startsAtIso) {
      setError("La hora de fin tiene que ser posterior a la de inicio.");
      return;
    }

    setLoading(true);

    const payload = {
      customer_name: customerName,
      customer_phone: customerPhone,
      customer_email: customerEmail || null,
      notes: notes || null,
      starts_at: startsAtIso,
      ends_at: endsAtIso,
      resource_id: resourceId === NO_RESOURCE ? null : resourceId,
    };

    const supabase = createClient();
    const { error } = isEdit
      ? await supabase
          .from("reservations")
          .update({ ...payload, status })
          .eq("id", reservation.id)
      : await supabase
          .from("reservations")
          .insert({ ...payload, business_id: businessId });

    setLoading(false);

    if (error) {
      setError("No pudimos guardar la reserva. Probá de nuevo.");
      return;
    }

    onSaved();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="customer_name">Cliente</Label>
          <Input
            id="customer_name"
            required
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="customer_phone">Teléfono</Label>
          <Input
            id="customer_phone"
            required
            value={customerPhone}
            onChange={(e) => setCustomerPhone(e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="starts_at">Inicio</Label>
          <Input
            id="starts_at"
            type="datetime-local"
            required
            value={startsAt}
            onChange={(e) => setStartsAt(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ends_at">Fin (opcional)</Label>
          <Input
            id="ends_at"
            type="datetime-local"
            value={endsAt}
            onChange={(e) => setEndsAt(e.target.value)}
          />
        </div>
      </div>

      {resources.length > 0 && (
        <div className="space-y-1.5">
          <Label>Recurso (opcional)</Label>
          <Select value={resourceId} onValueChange={setResourceId}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Sin recurso asignado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_RESOURCE}>Sin recurso asignado</SelectItem>
              {resources.map((resource) => (
                <SelectItem key={resource.id} value={resource.id}>
                  {resource.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {isEdit && (
        <div className="space-y-1.5">
          <Label>Estado</Label>
          <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="confirmed">Confirmada</SelectItem>
              <SelectItem value="cancelled">Cancelada</SelectItem>
              <SelectItem value="completed">Completada</SelectItem>
            </SelectContent>
          </Select>
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
        <Button type="submit" disabled={loading}>
          {loading ? "Guardando..." : isEdit ? "Guardar cambios" : "Crear reserva"}
        </Button>
      </DialogFooter>
    </form>
  );
}
