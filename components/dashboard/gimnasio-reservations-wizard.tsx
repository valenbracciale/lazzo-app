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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { Loader2, Plus, Trash2 } from "lucide-react";

type ClassRow = {
  id: string;
  name: string;
  daysOfWeek: number[];
  startTime: string;
  durationMinutes: number;
  capacity: number;
};
type InstructorRow = { id: string; name: string };

const DAY_LABELS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const LAST_STEP = 3;
const NO_INSTRUCTOR = "__none__";

function newClassRow(): ClassRow {
  return { id: crypto.randomUUID(), name: "", daysOfWeek: [], startTime: "18:00", durationMinutes: 60, capacity: 10 };
}

function validateClasses(classes: ClassRow[]): string | null {
  if (classes.length === 0) return "Agregá al menos una clase.";
  for (const c of classes) {
    if (!c.name.trim() || c.daysOfWeek.length === 0) {
      return "Cada clase necesita un nombre y al menos un día.";
    }
    if (c.durationMinutes <= 0) {
      return "La duración tiene que ser mayor a 0.";
    }
    if (c.capacity <= 0) {
      return "El cupo tiene que ser mayor a 0.";
    }
  }
  return null;
}

export function GimnasioReservationsWizard({
  businessId,
  initialStep,
  initialFormData,
  onDone,
}: {
  businessId: string;
  initialStep: number;
  initialFormData: Record<string, unknown>;
  onDone: () => void;
}) {
  const [step, setStep] = useState(Math.min(initialStep, LAST_STEP));
  const [classes, setClasses] = useState<ClassRow[]>(
    (initialFormData.classes as ClassRow[] | undefined) ?? []
  );
  const [instructors, setInstructors] = useState<InstructorRow[]>(
    (initialFormData.instructors as InstructorRow[] | undefined) ?? []
  );
  const [instructorAssignments, setInstructorAssignments] = useState<Record<string, string>>(
    (initialFormData.instructorAssignments as Record<string, string> | undefined) ?? {}
  );

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function persistAndAdvance(nextStep: number, snapshot: Record<string, unknown>) {
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

  function updateClass(index: number, patch: Partial<ClassRow>) {
    setClasses((prev) => prev.map((c, i) => (i === index ? { ...c, ...patch } : c)));
  }
  function toggleClassDay(index: number, day: number) {
    const c = classes[index];
    const daysOfWeek = c.daysOfWeek.includes(day)
      ? c.daysOfWeek.filter((d) => d !== day)
      : [...c.daysOfWeek, day].sort();
    updateClass(index, { daysOfWeek });
  }

  function handleContinueStep0() {
    const validationError = validateClasses(classes);
    if (validationError) {
      setError(validationError);
      return;
    }
    void persistAndAdvance(1, { classes });
  }

  function handleContinueStep1() {
    if (instructors.length === 0) {
      setError("Agregá al menos un profesor.");
      return;
    }
    for (const instructor of instructors) {
      if (!instructor.name.trim()) {
        setError("Cada profesor necesita un nombre.");
        return;
      }
    }
    void persistAndAdvance(2, { classes, instructors });
  }

  function handleContinueStep2() {
    void persistAndAdvance(3, { classes, instructors, instructorAssignments });
  }

  async function handleConfirm() {
    setSaving(true);
    setError(null);

    const supabase = createClient();
    const { error: rpcError } = await supabase.rpc("setup_gimnasio_reservations", {
      p_business_id: businessId,
      p_classes: classes.map((c) => ({
        id: c.id,
        name: c.name,
        days_of_week: c.daysOfWeek,
        start_time: c.startTime,
        duration_minutes: c.durationMinutes,
        capacity: c.capacity,
        instructor_id: instructorAssignments[c.id] ?? "",
      })),
      p_instructors: instructors.map((i) => ({ id: i.id, name: i.name })),
    });

    setSaving(false);
    if (rpcError) {
      if (rpcError.message?.includes("professional_linked_to_member")) {
        const name = rpcError.message.split("professional_linked_to_member:")[1]?.trim();
        setError(
          `No podés eliminar a ${name || "ese profesor"} porque tiene una cuenta de encargado vinculada. Revocá esa cuenta primero desde Configuración.`
        );
        return;
      }
      setError("No pudimos guardar la configuración. Probá de nuevo.");
      return;
    }
    onDone();
  }

  return (
    <div key={step} className="duration-300 animate-in fade-in-0 slide-in-from-right-2">
      {step === 0 && (
        <>
          <DialogHeader>
            <DialogTitle>Clases con horario y cupo</DialogTitle>
            <DialogDescription>
              Cada clase se repite semanalmente en los días que elijas, con un cupo máximo de alumnos.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-96 space-y-3 overflow-y-auto py-4">
            {classes.map((c, index) => (
              <div key={c.id} className="space-y-2 rounded-lg border p-3">
                <div className="flex items-end gap-2">
                  <div className="flex-1 space-y-1">
                    <Label>Clase</Label>
                    <Input
                      value={c.name}
                      placeholder="Yoga, Spinning..."
                      onChange={(e) => updateClass(index, { name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Hora</Label>
                    <Input
                      type="time"
                      value={c.startTime}
                      onChange={(e) => updateClass(index, { startTime: e.target.value })}
                    />
                  </div>
                  <div className="w-28 space-y-1">
                    <Label>Duración (min)</Label>
                    <Input
                      type="number"
                      min={5}
                      step={5}
                      value={c.durationMinutes}
                      onChange={(e) => updateClass(index, { durationMinutes: Number(e.target.value) || 5 })}
                    />
                  </div>
                  <div className="w-24 space-y-1">
                    <Label>Cupo</Label>
                    <Input
                      type="number"
                      min={1}
                      value={c.capacity}
                      onChange={(e) => updateClass(index, { capacity: Number(e.target.value) || 1 })}
                    />
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => setClasses((prev) => prev.filter((_, i) => i !== index))}
                  >
                    <Trash2 />
                  </Button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {DAY_LABELS.map((label, day) => (
                    <button
                      key={day}
                      type="button"
                      onClick={() => toggleClassDay(index, day)}
                      className={cn(
                        "rounded-md border px-2 py-1 text-xs transition-colors",
                        c.daysOfWeek.includes(day)
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
            <Button type="button" variant="outline" onClick={() => setClasses((prev) => [...prev, newClassRow()])}>
              <Plus /> Agregar clase
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
            <DialogTitle>Profesores</DialogTitle>
            <DialogDescription>
              Los vas a poder asignar a cada clase en el próximo paso.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-80 space-y-2 overflow-y-auto py-4">
            {instructors.map((instructor, index) => (
              <div key={instructor.id} className="flex items-end gap-2">
                <div className="flex-1 space-y-1">
                  <Label>Nombre</Label>
                  <Input
                    value={instructor.name}
                    onChange={(e) =>
                      setInstructors((prev) =>
                        prev.map((i, idx) => (idx === index ? { ...i, name: e.target.value } : i))
                      )
                    }
                  />
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => setInstructors((prev) => prev.filter((_, i) => i !== index))}
                >
                  <Trash2 />
                </Button>
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              onClick={() => setInstructors((prev) => [...prev, { id: crypto.randomUUID(), name: "" }])}
            >
              <Plus /> Agregar profesor
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
            <DialogTitle>Asignación de profesores</DialogTitle>
            <DialogDescription>
              Elegí qué profesor dicta cada clase. Podés dejarla sin asignar por ahora.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-96 space-y-2 overflow-y-auto py-4">
            {classes.map((c) => (
              <div key={c.id} className="flex items-center justify-between gap-2 rounded-lg border p-3">
                <span className="text-sm font-medium">{c.name}</span>
                <Select
                  value={instructorAssignments[c.id] ?? NO_INSTRUCTOR}
                  onValueChange={(value) =>
                    setInstructorAssignments((prev) => ({
                      ...prev,
                      [c.id]: value === NO_INSTRUCTOR ? "" : value,
                    }))
                  }
                >
                  <SelectTrigger className="w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_INSTRUCTOR}>Sin asignar</SelectItem>
                    {instructors.map((instructor) => (
                      <SelectItem key={instructor.id} value={instructor.id}>
                        {instructor.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
            <DialogTitle>Confirmá la configuración de Turnos</DialogTitle>
            <DialogDescription>
              {classes.length} clase{classes.length === 1 ? "" : "s"} ·{" "}
              {instructors.length} profesor{instructors.length === 1 ? "" : "es"}
            </DialogDescription>
          </DialogHeader>
          <p className="py-4 text-sm text-muted-foreground">
            Podés revisar los pasos anteriores con &quot;Volver&quot; si algo no es correcto.
          </p>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button variant="outline" onClick={() => setStep(2)} disabled={saving}>Volver</Button>
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
