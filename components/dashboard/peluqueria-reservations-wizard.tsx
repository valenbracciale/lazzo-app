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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { Loader2, Plus, Trash2 } from "lucide-react";

type ServiceRow = { id: string; name: string; durationMinutes: number };
type ShiftRow = { name: string; daysOfWeek: number[]; startTime: string; endTime: string };
type ProfessionalRow = {
  id: string;
  name: string;
  hasCustomSchedule: boolean;
  shifts: ShiftRow[];
};

const DAY_LABELS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const LAST_STEP = 4;

function newShiftRow(): ShiftRow {
  return { name: "", daysOfWeek: [], startTime: "09:00", endTime: "18:00" };
}

function ShiftRowsEditor({
  shifts,
  onChange,
}: {
  shifts: ShiftRow[];
  onChange: (shifts: ShiftRow[]) => void;
}) {
  function updateShift(index: number, patch: Partial<ShiftRow>) {
    onChange(shifts.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  }
  function removeShift(index: number) {
    onChange(shifts.filter((_, i) => i !== index));
  }
  function toggleDay(index: number, day: number) {
    const shift = shifts[index];
    const daysOfWeek = shift.daysOfWeek.includes(day)
      ? shift.daysOfWeek.filter((d) => d !== day)
      : [...shift.daysOfWeek, day].sort();
    updateShift(index, { daysOfWeek });
  }

  return (
    <div className="space-y-3">
      {shifts.map((shift, index) => (
        <div key={index} className="space-y-2 rounded-lg border p-3">
          <div className="flex items-end gap-2">
            <div className="flex-1 space-y-1">
              <Label>Nombre</Label>
              <Input
                value={shift.name}
                placeholder="Mañana, Tarde..."
                onChange={(e) => updateShift(index, { name: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label>Desde</Label>
              <Input
                type="time"
                value={shift.startTime}
                onChange={(e) => updateShift(index, { startTime: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label>Hasta</Label>
              <Input
                type="time"
                value={shift.endTime}
                onChange={(e) => updateShift(index, { endTime: e.target.value })}
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
                onClick={() => toggleDay(index, day)}
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
      <Button type="button" variant="outline" onClick={() => onChange([...shifts, newShiftRow()])}>
        <Plus /> Agregar turno
      </Button>
    </div>
  );
}

function validateShifts(shifts: ShiftRow[]): string | null {
  if (shifts.length === 0) return "Agregá al menos un turno.";
  for (const shift of shifts) {
    if (!shift.name.trim() || shift.daysOfWeek.length === 0) {
      return "Cada turno necesita un nombre y al menos un día.";
    }
    if (shift.endTime <= shift.startTime) {
      return "El horario de cierre tiene que ser posterior al de apertura.";
    }
  }
  return null;
}

export function PeluqueriaReservationsWizard({
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
  const [services, setServices] = useState<ServiceRow[]>(
    (initialFormData.services as ServiceRow[] | undefined) ?? []
  );
  const [generalShifts, setGeneralShifts] = useState<ShiftRow[]>(
    (initialFormData.generalShifts as ShiftRow[] | undefined) ?? []
  );
  const [professionals, setProfessionals] = useState<ProfessionalRow[]>(
    (initialFormData.professionals as ProfessionalRow[] | undefined) ?? []
  );
  const [serviceAssignments, setServiceAssignments] = useState<Record<string, string[]>>(
    (initialFormData.serviceAssignments as Record<string, string[]> | undefined) ?? {}
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

  function addService() {
    setServices((prev) => [
      ...prev,
      { id: crypto.randomUUID(), name: "", durationMinutes: 30 },
    ]);
  }
  function removeService(index: number) {
    setServices((prev) => prev.filter((_, i) => i !== index));
  }

  function handleContinueStep0() {
    if (services.length === 0) {
      setError("Agregá al menos un servicio.");
      return;
    }
    for (const service of services) {
      if (!service.name.trim() || service.durationMinutes <= 0) {
        setError("Cada servicio necesita un nombre y una duración válida.");
        return;
      }
    }
    void persistAndAdvance(1, { services });
  }

  function handleContinueStep1() {
    const validationError = validateShifts(generalShifts);
    if (validationError) {
      setError(validationError);
      return;
    }
    void persistAndAdvance(2, { services, generalShifts });
  }

  function handleContinueStep2() {
    if (professionals.length === 0) {
      setError("Agregá al menos un profesional.");
      return;
    }
    for (const professional of professionals) {
      if (!professional.name.trim()) {
        setError("Cada profesional necesita un nombre.");
        return;
      }
      if (professional.hasCustomSchedule) {
        const validationError = validateShifts(professional.shifts);
        if (validationError) {
          setError(validationError);
          return;
        }
      }
    }

    // Default: every professional can perform every service, unless the
    // matrix step (next) is used to narrow it down. Preserve any existing
    // choices already made for professionals/services that still exist.
    const allServiceIds = services.map((s) => s.id);
    const nextAssignments: Record<string, string[]> = {};
    for (const professional of professionals) {
      nextAssignments[professional.id] =
        serviceAssignments[professional.id] ?? allServiceIds;
    }
    setServiceAssignments(nextAssignments);

    void persistAndAdvance(3, {
      services,
      generalShifts,
      professionals,
      serviceAssignments: nextAssignments,
    });
  }

  function handleContinueStep3() {
    void persistAndAdvance(4, {
      services,
      generalShifts,
      professionals,
      serviceAssignments,
    });
  }

  async function handleConfirm() {
    setSaving(true);
    setError(null);

    const supabase = createClient();
    const { error: rpcError } = await supabase.rpc("setup_peluqueria_reservations", {
      p_business_id: businessId,
      p_services: services.map((s) => ({
        id: s.id,
        name: s.name,
        duration_minutes: s.durationMinutes,
      })),
      p_general_shifts: generalShifts.map((s) => ({
        name: s.name,
        days_of_week: s.daysOfWeek,
        start_time: s.startTime,
        end_time: s.endTime,
      })),
      p_professionals: professionals.map((p) => ({
        id: p.id,
        name: p.name,
        shifts: p.hasCustomSchedule
          ? p.shifts.map((s) => ({
              name: s.name,
              days_of_week: s.daysOfWeek,
              start_time: s.startTime,
              end_time: s.endTime,
            }))
          : [],
        service_ids: serviceAssignments[p.id] ?? [],
      })),
    });

    setSaving(false);
    if (rpcError) {
      if (rpcError.message?.includes("professional_linked_to_member")) {
        const name = rpcError.message.split("professional_linked_to_member:")[1]?.trim();
        setError(
          `No podés eliminar a ${name || "ese profesional"} porque tiene una cuenta de encargado vinculada. Revocá esa cuenta primero desde Configuración.`
        );
        return;
      }
      if (rpcError.message?.includes("service_has_reservations")) {
        const name = rpcError.message.split("service_has_reservations:")[1]?.trim();
        setError(
          `No podés eliminar el servicio "${name || "ese servicio"}" porque tiene turnos asociados. Dejalo en la lista si querés conservar ese historial.`
        );
        return;
      }
      if (rpcError.message?.includes("professional_has_reservations")) {
        const name = rpcError.message.split("professional_has_reservations:")[1]?.trim();
        setError(
          `No podés eliminar a ${name || "ese profesional"} porque tiene turnos asociados. Dejalo en la lista si querés conservar ese historial.`
        );
        return;
      }
      setError("No pudimos guardar la configuración. Probá de nuevo.");
      return;
    }
    onDone();
  }

  function toggleAssignment(professionalId: string, serviceId: string) {
    setServiceAssignments((prev) => {
      const current = prev[professionalId] ?? [];
      const next = current.includes(serviceId)
        ? current.filter((id) => id !== serviceId)
        : [...current, serviceId];
      return { ...prev, [professionalId]: next };
    });
  }

  return (
    <div key={step} className="duration-300 animate-in fade-in-0 slide-in-from-right-2">
      {step === 0 && (
        <>
          <DialogHeader>
            <DialogTitle>Servicios que ofrecés</DialogTitle>
            <DialogDescription>
              Cada servicio tiene una duración fija, sin importar quién lo haga.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-80 space-y-2 overflow-y-auto py-4">
            {services.map((service, index) => (
              <div key={service.id} className="flex items-end gap-2">
                <div className="flex-1 space-y-1">
                  <Label>Servicio</Label>
                  <Input
                    value={service.name}
                    placeholder="Corte, Color..."
                    onChange={(e) =>
                      setServices((prev) =>
                        prev.map((s, i) => (i === index ? { ...s, name: e.target.value } : s))
                      )
                    }
                  />
                </div>
                <div className="w-32 space-y-1">
                  <Label>Duración (min)</Label>
                  <Input
                    type="number"
                    min={5}
                    step={5}
                    value={service.durationMinutes}
                    onChange={(e) =>
                      setServices((prev) =>
                        prev.map((s, i) =>
                          i === index ? { ...s, durationMinutes: Number(e.target.value) || 5 } : s
                        )
                      )
                    }
                  />
                </div>
                <Button type="button" variant="outline" size="icon" onClick={() => removeService(index)}>
                  <Trash2 />
                </Button>
              </div>
            ))}
            <Button type="button" variant="outline" onClick={addService}>
              <Plus /> Agregar servicio
            </Button>
          </div>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button onClick={handleContinueStep0} disabled={saving}>
              {saving && <Loader2 className="animate-spin" />}
              {saving ? "Guardando..." : "Continuar"}
            </Button>
          </DialogFooter>
        </>
      )}

      {step === 1 && (
        <>
          <DialogHeader>
            <DialogTitle>Turnos generales del local</DialogTitle>
            <DialogDescription>
              Los profesionales sin horario propio siguen este horario general.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-80 overflow-y-auto py-4">
            <ShiftRowsEditor shifts={generalShifts} onChange={setGeneralShifts} />
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
            <DialogTitle>Profesionales</DialogTitle>
            <DialogDescription>
              Por defecto siguen el horario general - activá &quot;Horario propio&quot; para
              darle a alguien días u horarios distintos.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-96 space-y-3 overflow-y-auto py-4">
            {professionals.map((professional, index) => (
              <div key={professional.id} className="space-y-2 rounded-lg border p-3">
                <div className="flex items-end gap-2">
                  <div className="flex-1 space-y-1">
                    <Label>Nombre</Label>
                    <Input
                      value={professional.name}
                      onChange={(e) =>
                        setProfessionals((prev) =>
                          prev.map((p, i) => (i === index ? { ...p, name: e.target.value } : p))
                        )
                      }
                    />
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() =>
                      setProfessionals((prev) => prev.filter((_, i) => i !== index))
                    }
                  >
                    <Trash2 />
                  </Button>
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={professional.hasCustomSchedule}
                    onChange={(e) =>
                      setProfessionals((prev) =>
                        prev.map((p, i) =>
                          i === index ? { ...p, hasCustomSchedule: e.target.checked } : p
                        )
                      )
                    }
                  />
                  Horario propio (distinto al general)
                </label>
                {professional.hasCustomSchedule && (
                  <ShiftRowsEditor
                    shifts={professional.shifts}
                    onChange={(shifts) =>
                      setProfessionals((prev) =>
                        prev.map((p, i) => (i === index ? { ...p, shifts } : p))
                      )
                    }
                  />
                )}
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                setProfessionals((prev) => [
                  ...prev,
                  { id: crypto.randomUUID(), name: "", hasCustomSchedule: false, shifts: [] },
                ])
              }
            >
              <Plus /> Agregar profesional
            </Button>
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
            <DialogTitle>Restricciones de servicios</DialogTitle>
            <DialogDescription>
              Por defecto todos pueden hacer todo. Desmarcá para restringir un servicio a
              profesionales puntuales.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-96 overflow-auto py-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Profesional</TableHead>
                  {services.map((service) => (
                    <TableHead key={service.id} className="text-center">
                      {service.name}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {professionals.map((professional) => (
                  <TableRow key={professional.id}>
                    <TableCell>{professional.name}</TableCell>
                    {services.map((service) => (
                      <TableCell key={service.id} className="text-center">
                        <input
                          type="checkbox"
                          checked={(serviceAssignments[professional.id] ?? []).includes(service.id)}
                          onChange={() => toggleAssignment(professional.id, service.id)}
                        />
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
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
            <DialogTitle>Confirmá la configuración de Turnos</DialogTitle>
            <DialogDescription>
              {services.length} servicio{services.length === 1 ? "" : "s"} ·{" "}
              {professionals.length} profesional{professionals.length === 1 ? "" : "es"}
            </DialogDescription>
          </DialogHeader>
          <p className="py-4 text-sm text-muted-foreground">
            Podés revisar los pasos anteriores con &quot;Volver&quot; si algo no es correcto.
          </p>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button variant="outline" onClick={() => setStep(3)} disabled={saving}>Volver</Button>
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
