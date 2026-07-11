"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
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
import {
  assignTableToReservation,
  fetchFreeResourcesForReservation,
} from "@/app/dashboard/reservations/actions";
import type { RestaurantReservation } from "@/components/dashboard/restaurant-reservations-view";

type FreeResource = { id: string; name: string; capacity: number; zone_name: string | null };

export function AssignTableDialog({
  reservation,
  onClose,
  onSaved,
}: {
  reservation: RestaurantReservation;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [freeResources, setFreeResources] = useState<FreeResource[]>([]);
  const [selectedResourceId, setSelectedResourceId] = useState<string | null>(null);
  const [loadingResources, setLoadingResources] = useState(true);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchFreeResourcesForReservation(reservation.id).then((result) => {
      if (!cancelled) {
        setFreeResources(result);
        setSelectedResourceId(result[0]?.id ?? null);
        setLoadingResources(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [reservation.id]);

  async function handleSave() {
    if (!selectedResourceId) {
      setError("Elegí una mesa.");
      return;
    }

    setSaving(true);
    setError(null);

    const { error: assignError } = await assignTableToReservation({
      reservationId: reservation.id,
      resourceId: selectedResourceId,
    });

    setSaving(false);
    if (assignError) {
      setError(assignError);
      return;
    }

    onSaved();
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Asignar mesa — {reservation.customer_name}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
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
          <Button onClick={handleSave} disabled={saving || !selectedResourceId}>
            {saving && <Loader2 className="animate-spin" />}
            {saving ? "Guardando..." : "Asignar mesa"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
