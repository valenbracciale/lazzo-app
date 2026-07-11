"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { Loader2, Plus, Trash2 } from "lucide-react";

type TableRow = { id: string; name: string; capacity: number };
type ZoneRow = { zoneName: string; tableSize: number; tableCount: number };
type ShiftRow = {
  name: string;
  daysOfWeek: number[];
  startTime: string;
  endTime: string;
};
type CapacityMode = "tables" | "zones";
type AssignmentMode = "automatic" | "manual";

const DAY_LABELS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const LAST_STEP = 5;

function defaultDurationForSize(size: number): number {
  if (size <= 2) return 60;
  if (size <= 4) return 90;
  if (size <= 6) return 120;
  return 150;
}

function distinctSizes(mode: CapacityMode | null, tables: TableRow[], zones: ZoneRow[]): number[] {
  const sizes = mode === "tables" ? tables.map((t) => t.capacity) : zones.map((z) => z.tableSize);
  return Array.from(new Set(sizes.filter((s) => s > 0))).sort((a, b) => a - b);
}

function buildResourcesPayload(
  mode: CapacityMode,
  tables: TableRow[],
  zones: ZoneRow[],
  durations: Record<number, number>
) {
  if (mode === "tables") {
    return tables.map((t) => ({
      id: t.id,
      name: t.name,
      capacity: t.capacity,
      zone_name: null,
      duration_minutes: durations[t.capacity] ?? defaultDurationForSize(t.capacity),
    }));
  }
  const resources: { name: string; capacity: number; zone_name: string; duration_minutes: number }[] = [];
  for (const zone of zones) {
    for (let i = 1; i <= zone.tableCount; i++) {
      resources.push({
        name: `${zone.zoneName} - Mesa ${i}`,
        capacity: zone.tableSize,
        zone_name: zone.zoneName,
        duration_minutes: durations[zone.tableSize] ?? defaultDurationForSize(zone.tableSize),
      });
    }
  }
  return resources;
}

export function RestaurantReservationsWizard({
  businessId,
  initialStep,
  initialFormData,
  onDone,
  isEditingCompleted = false,
}: {
  businessId: string;
  initialStep: number;
  initialFormData: Record<string, unknown>;
  onDone: () => void;
  isEditingCompleted?: boolean;
}) {
  const [step, setStep] = useState(Math.min(initialStep, LAST_STEP));
  const [capacityMode, setCapacityMode] = useState<CapacityMode | null>(
    (initialFormData.capacityMode as CapacityMode | undefined) ?? null
  );
  const [tables, setTables] = useState<TableRow[]>(
    ((initialFormData.tables as TableRow[] | undefined) ?? []).map((t) => ({
      ...t,
      id: t.id ?? crypto.randomUUID(),
    }))
  );
  const [zones, setZones] = useState<ZoneRow[]>(
    (initialFormData.zones as ZoneRow[] | undefined) ?? []
  );
  const [durations, setDurations] = useState<Record<number, number>>(
    (initialFormData.durations as Record<number, number> | undefined) ?? {}
  );
  const [shifts, setShifts] = useState<ShiftRow[]>(
    (initialFormData.shifts as ShiftRow[] | undefined) ?? []
  );
  const [assignmentMode, setAssignmentMode] = useState<AssignmentMode | null>(
    (initialFormData.assignmentMode as AssignmentMode | undefined) ?? null
  );

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function persistAndAdvance(nextStep: number, snapshot: Record<string, unknown>) {
    // Editing an already-completed section (from the settings edit panel)
    // always restarts at step 0 and never resumes from saved progress, so
    // autosaving intermediate steps here serves no purpose - and would
    // wrongly flip `completed` back to false for a live, working section
    // (shown as "not configured" to the owner and every encargado) the
    // instant the user takes one step, even if they finish the edit later.
    if (isEditingCompleted) {
      setStep(nextStep);
      return;
    }

    setSaving(true);
    setError(null);

    const supabase = createClient();
    const { error: upsertError } = await supabase
      .from("business_section_setup")
      .upsert(
        {
          business_id: businessId,
          section: "reservations",
          completed: false,
          current_step: nextStep,
          form_data: snapshot,
        },
        { onConflict: "business_id,section" }
      );

    setSaving(false);
    if (upsertError) {
      setError("No pudimos guardar el progreso. Probá de nuevo.");
      return;
    }
    setStep(nextStep);
  }

  function handleContinueStep0() {
    if (!capacityMode) return;
    void persistAndAdvance(1, { capacityMode });
  }

  function handleContinueStep1() {
    if (capacityMode === "tables") {
      if (tables.length === 0) {
        setError("Agregá al menos una mesa.");
        return;
      }
      for (const table of tables) {
        if (!table.name.trim() || table.capacity <= 0) {
          setError("Cada mesa necesita un nombre y una capacidad mayor a 0.");
          return;
        }
      }
    }
    if (capacityMode === "zones") {
      if (zones.length === 0) {
        setError("Agregá al menos una zona.");
        return;
      }
      for (const zone of zones) {
        if (!zone.zoneName.trim() || zone.tableSize <= 0 || zone.tableCount <= 0) {
          setError("Cada zona necesita un nombre, un tamaño de mesa y una cantidad de mesas mayores a 0.");
          return;
        }
      }
    }
    const sizes = distinctSizes(capacityMode, tables, zones);
    const nextDurations = { ...durations };
    sizes.forEach((size) => {
      if (nextDurations[size] === undefined) nextDurations[size] = defaultDurationForSize(size);
    });
    setDurations(nextDurations);
    void persistAndAdvance(2, { capacityMode, tables, zones, durations: nextDurations });
  }

  function handleContinueStep2() {
    void persistAndAdvance(3, { capacityMode, tables, zones, durations, shifts });
  }

  function handleContinueStep3() {
    if (shifts.length === 0) {
      setError("Agregá al menos un turno.");
      return;
    }
    for (const shift of shifts) {
      if (!shift.name.trim() || shift.daysOfWeek.length === 0) {
        setError("Cada turno necesita un nombre y al menos un día.");
        return;
      }
      if (shift.endTime === shift.startTime) {
        // A shift like 19:00-01:00 crosses midnight and is valid - only an
        // identical open/close time (zero-length shift) is actually invalid.
        setError("El horario de cierre no puede ser igual al de apertura.");
        return;
      }
    }
    void persistAndAdvance(4, { capacityMode, tables, zones, durations, shifts });
  }

  function handleContinueStep4() {
    if (!assignmentMode) return;
    void persistAndAdvance(5, {
      capacityMode,
      tables,
      zones,
      durations,
      shifts,
      assignmentMode,
    });
  }

  async function handleConfirm() {
    if (!capacityMode || !assignmentMode) return;
    setSaving(true);
    setError(null);

    const resourcesPayload = buildResourcesPayload(capacityMode, tables, zones, durations);
    const shiftsPayload = shifts.map((s) => ({
      name: s.name,
      days_of_week: s.daysOfWeek,
      start_time: s.startTime,
      end_time: s.endTime,
    }));

    const supabase = createClient();
    const { error: rpcError } = await supabase.rpc("setup_restaurant_reservations", {
      p_business_id: businessId,
      p_capacity_mode: capacityMode,
      p_assignment_mode: assignmentMode,
      p_resources: resourcesPayload,
      p_shifts: shiftsPayload,
    });

    setSaving(false);
    if (rpcError) {
      setError("No pudimos guardar la configuración. Probá de nuevo.");
      return;
    }
    onDone();
  }

  function addTable() {
    setTables((prev) => [
      ...prev,
      { id: crypto.randomUUID(), name: `Mesa ${prev.length + 1}`, capacity: 2 },
    ]);
  }
  function removeTable(index: number) {
    setTables((prev) => prev.filter((_, i) => i !== index));
  }
  function addZone() {
    setZones((prev) => [...prev, { zoneName: "", tableSize: 2, tableCount: 1 }]);
  }
  function removeZone(index: number) {
    setZones((prev) => prev.filter((_, i) => i !== index));
  }
  function addShift() {
    setShifts((prev) => [...prev, { name: "", daysOfWeek: [], startTime: "12:00", endTime: "15:00" }]);
  }
  function removeShift(index: number) {
    setShifts((prev) => prev.filter((_, i) => i !== index));
  }
  function toggleShiftDay(index: number, day: number) {
    setShifts((prev) =>
      prev.map((s, i) =>
        i === index
          ? {
              ...s,
              daysOfWeek: s.daysOfWeek.includes(day)
                ? s.daysOfWeek.filter((d) => d !== day)
                : [...s.daysOfWeek, day].sort(),
            }
          : s
      )
    );
  }

  const sizes = distinctSizes(capacityMode, tables, zones);

  return (
    <div key={step} className="duration-300 animate-in fade-in-0 slide-in-from-right-2">
      {step === 0 && (
        <>
          <DialogHeader>
            <DialogTitle>¿Cómo manejás la capacidad?</DialogTitle>
            <DialogDescription>
              Elegí si vas a cargar cada mesa individualmente o agrupar mesas por zona.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-4 sm:grid-cols-2">
            {(
              [
                { value: "tables", label: "Mesa por mesa", desc: "Cargás cada mesa con su capacidad." },
                { value: "zones", label: "Por zonas", desc: "Agrupás mesas del mismo tamaño en una zona." },
              ] as const
            ).map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setCapacityMode(opt.value)}
                className={cn(
                  "rounded-lg border p-4 text-left transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-md hover:shadow-primary/20",
                  capacityMode === opt.value
                    ? "border-primary bg-primary/5 ring-1 ring-primary"
                    : "border-border hover:bg-muted"
                )}
              >
                <p className="font-semibold">{opt.label}</p>
                <p className="mt-1 text-xs text-muted-foreground">{opt.desc}</p>
              </button>
            ))}
          </div>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button onClick={handleContinueStep0} disabled={!capacityMode || saving}>
              {saving && <Loader2 className="animate-spin" />}
              {saving ? "Guardando..." : "Continuar"}
            </Button>
          </DialogFooter>
        </>
      )}

      {step === 1 && capacityMode === "tables" && (
        <>
          <DialogHeader>
            <DialogTitle>Cargá tus mesas</DialogTitle>
            <DialogDescription>Nombre y capacidad (comensales) de cada mesa.</DialogDescription>
          </DialogHeader>
          <div className="max-h-80 space-y-2 overflow-y-auto py-4">
            {tables.map((table, index) => (
              <div key={table.id} className="flex items-end gap-2">
                <div className="flex-1 space-y-1">
                  <Label>Nombre</Label>
                  <Input
                    value={table.name}
                    onChange={(e) =>
                      setTables((prev) =>
                        prev.map((t, i) => (i === index ? { ...t, name: e.target.value } : t))
                      )
                    }
                  />
                </div>
                <div className="w-28 space-y-1">
                  <Label>Capacidad</Label>
                  <Input
                    type="number"
                    min={1}
                    value={table.capacity}
                    onChange={(e) =>
                      setTables((prev) =>
                        prev.map((t, i) =>
                          i === index ? { ...t, capacity: Number(e.target.value) || 1 } : t
                        )
                      )
                    }
                  />
                </div>
                <Button type="button" variant="outline" size="icon" onClick={() => removeTable(index)}>
                  <Trash2 />
                </Button>
              </div>
            ))}
            <Button type="button" variant="outline" onClick={addTable}>
              <Plus /> Agregar mesa
            </Button>
          </div>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button variant="outline" onClick={() => setStep(0)} disabled={saving}>Volver</Button>
            <Button onClick={handleContinueStep1} disabled={saving}>
              {saving && <Loader2 className="animate-spin" />}
              {saving ? "Guardando..." : "Continuar"}
            </Button>
          </DialogFooter>
        </>
      )}

      {step === 1 && capacityMode === "zones" && (
        <>
          <DialogHeader>
            <DialogTitle>Cargá tus zonas</DialogTitle>
            <DialogDescription>Nombre de la zona, tamaño de mesa y cantidad de mesas.</DialogDescription>
          </DialogHeader>
          <div className="max-h-80 space-y-2 overflow-y-auto py-4">
            {zones.map((zone, index) => (
              <div key={index} className="flex items-end gap-2">
                <div className="flex-1 space-y-1">
                  <Label>Zona</Label>
                  <Input
                    value={zone.zoneName}
                    onChange={(e) =>
                      setZones((prev) =>
                        prev.map((z, i) => (i === index ? { ...z, zoneName: e.target.value } : z))
                      )
                    }
                  />
                </div>
                <div className="w-28 space-y-1">
                  <Label>Tamaño mesa</Label>
                  <Input
                    type="number"
                    min={1}
                    value={zone.tableSize}
                    onChange={(e) =>
                      setZones((prev) =>
                        prev.map((z, i) =>
                          i === index ? { ...z, tableSize: Number(e.target.value) || 1 } : z
                        )
                      )
                    }
                  />
                </div>
                <div className="w-28 space-y-1">
                  <Label>Cant. mesas</Label>
                  <Input
                    type="number"
                    min={1}
                    value={zone.tableCount}
                    onChange={(e) =>
                      setZones((prev) =>
                        prev.map((z, i) =>
                          i === index ? { ...z, tableCount: Number(e.target.value) || 1 } : z
                        )
                      )
                    }
                  />
                </div>
                <Button type="button" variant="outline" size="icon" onClick={() => removeZone(index)}>
                  <Trash2 />
                </Button>
              </div>
            ))}
            <Button type="button" variant="outline" onClick={addZone}>
              <Plus /> Agregar zona
            </Button>
          </div>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button variant="outline" onClick={() => setStep(0)} disabled={saving}>Volver</Button>
            <Button onClick={handleContinueStep1} disabled={saving}>
              {saving && <Loader2 className="animate-spin" />}
              {saving ? "Guardando..." : "Continuar"}
            </Button>
          </DialogFooter>
        </>
      )}

      {step === 2 && (
        <>
          <DialogHeader>
            <DialogTitle>Duración estimada por tamaño de mesa</DialogTitle>
            <DialogDescription>
              Cuánto tiempo ocupa en promedio una mesa de cada tamaño. Podés ajustarlo.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-4">
            {sizes.map((size) => (
              <div key={size} className="flex items-center gap-3">
                <Label className="flex-1">Mesas de {size}</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min={15}
                    step={15}
                    className="w-24"
                    value={durations[size] ?? defaultDurationForSize(size)}
                    onChange={(e) =>
                      setDurations((prev) => ({ ...prev, [size]: Number(e.target.value) || 15 }))
                    }
                  />
                  <span className="text-sm text-muted-foreground">min</span>
                </div>
              </div>
            ))}
          </div>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button variant="outline" onClick={() => setStep(1)} disabled={saving}>Volver</Button>
            <Button onClick={handleContinueStep2} disabled={saving}>
              {saving && <Loader2 className="animate-spin" />}
              {saving ? "Guardando..." : "Continuar"}
            </Button>
          </DialogFooter>
        </>
      )}

      {step === 3 && (
        <>
          <DialogHeader>
            <DialogTitle>Turnos de apertura</DialogTitle>
            <DialogDescription>
              Agregá cada turno con sus días y horario. Si un turno cambia de horario un
              día específico (ej. cena de fin de semana), agregalo como un turno aparte.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-80 space-y-3 overflow-y-auto py-4">
            {shifts.map((shift, index) => (
              <div key={index} className="space-y-2 rounded-lg border p-3">
                <div className="flex items-end gap-2">
                  <div className="flex-1 space-y-1">
                    <Label>Nombre</Label>
                    <Input
                      value={shift.name}
                      placeholder="Almuerzo, Cena..."
                      onChange={(e) =>
                        setShifts((prev) =>
                          prev.map((s, i) => (i === index ? { ...s, name: e.target.value } : s))
                        )
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Desde</Label>
                    <Input
                      type="time"
                      value={shift.startTime}
                      onChange={(e) =>
                        setShifts((prev) =>
                          prev.map((s, i) => (i === index ? { ...s, startTime: e.target.value } : s))
                        )
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Hasta</Label>
                    <Input
                      type="time"
                      value={shift.endTime}
                      onChange={(e) =>
                        setShifts((prev) =>
                          prev.map((s, i) => (i === index ? { ...s, endTime: e.target.value } : s))
                        )
                      }
                    />
                  </div>
                  <Button type="button" variant="outline" size="icon" onClick={() => removeShift(index)}>
                    <Trash2 />
                  </Button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {DAY_LABELS.map((label, day) => (
                    <button
                      key={day}
                      type="button"
                      onClick={() => toggleShiftDay(index, day)}
                      className={cn(
                        "rounded-md border px-2 py-1 text-xs transition-colors",
                        shift.daysOfWeek.includes(day)
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border text-muted-foreground hover:bg-muted"
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
            <Button type="button" variant="outline" onClick={addShift}>
              <Plus /> Agregar turno
            </Button>
          </div>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button variant="outline" onClick={() => setStep(2)} disabled={saving}>Volver</Button>
            <Button onClick={handleContinueStep3} disabled={saving}>
              {saving && <Loader2 className="animate-spin" />}
              {saving ? "Guardando..." : "Continuar"}
            </Button>
          </DialogFooter>
        </>
      )}

      {step === 4 && (
        <>
          <DialogHeader>
            <DialogTitle>Asignación de mesas</DialogTitle>
            <DialogDescription>
              ¿Cómo se asigna una mesa a una reserva nueva?
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-4 sm:grid-cols-2">
            {(
              [
                { value: "automatic", label: "Automática", desc: "El sistema elige sola una mesa con capacidad suficiente." },
                { value: "manual", label: "Manual", desc: "Vos elegís la mesa al crear cada reserva." },
              ] as const
            ).map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setAssignmentMode(opt.value)}
                className={cn(
                  "rounded-lg border p-4 text-left transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-md hover:shadow-primary/20",
                  assignmentMode === opt.value
                    ? "border-primary bg-primary/5 ring-1 ring-primary"
                    : "border-border hover:bg-muted"
                )}
              >
                <p className="font-semibold">{opt.label}</p>
                <p className="mt-1 text-xs text-muted-foreground">{opt.desc}</p>
              </button>
            ))}
          </div>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button variant="outline" onClick={() => setStep(3)} disabled={saving}>Volver</Button>
            <Button onClick={handleContinueStep4} disabled={!assignmentMode || saving}>
              {saving && <Loader2 className="animate-spin" />}
              {saving ? "Guardando..." : "Continuar"}
            </Button>
          </DialogFooter>
        </>
      )}

      {step === 5 && (
        <>
          <DialogHeader>
            <DialogTitle>Confirmá la configuración de Reservas</DialogTitle>
            <DialogDescription>
              {capacityMode === "tables" ? `${tables.length} mesas` : `${zones.length} zonas`} ·{" "}
              {shifts.length} turno{shifts.length === 1 ? "" : "s"} · asignación{" "}
              {assignmentMode === "automatic" ? "automática" : "manual"}
            </DialogDescription>
          </DialogHeader>
          <p className="py-4 text-sm text-muted-foreground">
            Podés revisar los pasos anteriores con &quot;Volver&quot; si algo no es correcto.
          </p>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button variant="outline" onClick={() => setStep(4)} disabled={saving}>Volver</Button>
            <Button onClick={handleConfirm} disabled={saving}>
              {saving && <Loader2 className="animate-spin" />}
              {saving ? "Guardando..." : "Confirmar configuración"}
            </Button>
          </DialogFooter>
        </>
      )}
    </div>
  );
}
