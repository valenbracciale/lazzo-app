"use client";

import { useEffect, useState } from "react";
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
import type { ClassInstanceWithSeats } from "@/lib/reservations/gimnasio-classes.server";
import { searchStudents, createStudent, type Student } from "@/app/dashboard/students/actions";
import {
  enrollStudentPunctual,
  enrollStudentRecurring,
  joinWaitlist,
} from "@/app/dashboard/reservations/gimnasio-actions";

export function GimnasioClassEnrollmentForm({
  instances,
  ownInstructorId,
  onSaved,
}: {
  instances: ClassInstanceWithSeats[];
  ownInstructorId?: string | null;
  onSaved: () => void;
}) {
  const visibleInstances = ownInstructorId
    ? instances.filter((i) => i.instructor_id === ownInstructorId)
    : instances;

  const [instanceId, setInstanceId] = useState(visibleInstances[0]?.id ?? "");
  const [mode, setMode] = useState<"punctual" | "recurring">("punctual");

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Student[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [creatingNew, setCreatingNew] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [classFull, setClassFull] = useState(false);

  useEffect(() => {
    if (!query.trim()) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setResults([]);
      return;
    }
    let cancelled = false;
    const timeout = setTimeout(() => {
      searchStudents(query).then((r) => {
        if (!cancelled) setResults(r);
      });
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [query]);

  const selectedInstance = visibleInstances.find((i) => i.id === instanceId);

  async function resolveStudent(): Promise<Student | null> {
    if (selectedStudent) return selectedStudent;
    if (creatingNew) {
      if (!newName.trim() || !newPhone.trim()) {
        setError("Completá nombre y teléfono del alumno nuevo.");
        return null;
      }
      const { student, error: createError } = await createStudent({
        name: newName,
        phone: newPhone,
        email: newEmail || null,
      });
      if (createError || !student) {
        setError(createError ?? "No pudimos guardar el alumno.");
        return null;
      }
      return student;
    }
    setError("Buscá y elegí un alumno, o cargá uno nuevo.");
    return null;
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setClassFull(false);

    if (!selectedInstance) {
      setError("Elegí una clase.");
      return;
    }

    setLoading(true);
    const student = await resolveStudent();
    if (!student) {
      setLoading(false);
      return;
    }

    const result =
      mode === "punctual"
        ? await enrollStudentPunctual({ classInstanceId: selectedInstance.id, studentId: student.id })
        : await enrollStudentRecurring({ classDefinitionId: selectedInstance.class_definition_id, studentId: student.id });

    setLoading(false);

    if (result.classFull) {
      setClassFull(true);
      setSelectedStudent(student);
      return;
    }
    if (result.error) {
      setError(result.error);
      return;
    }

    onSaved();
  }

  async function handleJoinWaitlist() {
    if (!selectedInstance || !selectedStudent) return;
    setLoading(true);
    const { error: waitlistError } = await joinWaitlist({
      classInstanceId: selectedInstance.id,
      studentId: selectedStudent.id,
    });
    setLoading(false);
    if (waitlistError) {
      setError(waitlistError);
      return;
    }
    onSaved();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <Label>Clase</Label>
        <Select value={instanceId} onValueChange={setInstanceId}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {visibleInstances.map((instance) => (
              <SelectItem key={instance.id} value={instance.id}>
                {instance.name} — {instance.seats_taken}/{instance.capacity}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
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

      <div className="space-y-1.5">
        <Label>Alumno</Label>
        {selectedStudent ? (
          <div className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
            <span>{selectedStudent.name} · {selectedStudent.phone}</span>
            <Button type="button" variant="ghost" size="sm" onClick={() => setSelectedStudent(null)}>
              Cambiar
            </Button>
          </div>
        ) : creatingNew ? (
          <div className="space-y-2 rounded-md border p-3">
            <Input placeholder="Nombre" value={newName} onChange={(e) => setNewName(e.target.value)} />
            <Input placeholder="Teléfono" value={newPhone} onChange={(e) => setNewPhone(e.target.value)} />
            <Input placeholder="Email (opcional)" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} />
            <Button type="button" variant="ghost" size="sm" onClick={() => setCreatingNew(false)}>
              Buscar alumno existente
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            <Input
              placeholder="Buscar por nombre o teléfono..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {results.length > 0 && (
              <div className="max-h-32 space-y-1 overflow-y-auto rounded-md border p-1">
                {results.map((student) => (
                  <button
                    key={student.id}
                    type="button"
                    onClick={() => setSelectedStudent(student)}
                    className="w-full rounded-sm px-2 py-1 text-left text-sm hover:bg-muted"
                  >
                    {student.name} · {student.phone}
                  </button>
                ))}
              </div>
            )}
            <Button type="button" variant="outline" size="sm" onClick={() => setCreatingNew(true)}>
              Cargar alumno nuevo
            </Button>
          </div>
        )}
      </div>

      {classFull && (
        <div className="space-y-2 rounded-md border border-amber-500/50 bg-amber-500/5 p-3 text-sm">
          <p>Esta clase ya no tiene cupo disponible.</p>
          <Button type="button" size="sm" onClick={handleJoinWaitlist} disabled={loading}>
            {loading && <Loader2 className="animate-spin" />}
            Anotarse en lista de espera
          </Button>
        </div>
      )}

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      <DialogFooter>
        <Button type="submit" disabled={loading || !selectedInstance}>
          {loading && <Loader2 className="animate-spin" />}
          {loading ? "Guardando..." : "Inscribir"}
        </Button>
      </DialogFooter>
    </form>
  );
}
