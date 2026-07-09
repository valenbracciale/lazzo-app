"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { shiftLocalDate, toLocalDateInputValue } from "@/lib/datetime";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2, Plus } from "lucide-react";
import {
  createStudent,
  createFeePlan,
  recordCashPayment,
  getFeesAggregateReport,
  type FeesAggregateReport,
} from "@/app/dashboard/students/actions";

type Student = { id: string; name: string; phone: string; email: string | null };
type Fee = {
  id: string;
  student_id: string;
  class_definition_id: string | null;
  amount: number;
  status: "pending" | "active" | "overdue" | "cancelled";
  next_due_date: string | null;
};
type ClassDefinition = { id: string; name: string };

const statusLabel: Record<Fee["status"], string> = {
  pending: "Sin activar",
  active: "Al día",
  overdue: "Vencida",
  cancelled: "Cancelada",
};
const statusVariant: Record<Fee["status"], "default" | "secondary" | "destructive" | "outline"> = {
  pending: "outline",
  active: "default",
  overdue: "destructive",
  cancelled: "secondary",
};

function effectiveStatus(fee: Fee, today: string): Fee["status"] {
  if (fee.status === "cancelled" || fee.status === "pending") return fee.status;
  if (fee.next_due_date && fee.next_due_date < today) return "overdue";
  return fee.status;
}

function noopSubscribe() {
  return () => {};
}
function getTodaySnapshot() {
  return toLocalDateInputValue(new Date());
}
function getTodayServerSnapshot() {
  return null;
}

export function StudentsView({
  students,
  fees,
  classDefinitions,
  isOwner,
}: {
  students: Student[];
  fees: Fee[];
  classDefinitions: ClassDefinition[];
  isOwner: boolean;
}) {
  const router = useRouter();
  const today = useSyncExternalStore(noopSubscribe, getTodaySnapshot, getTodayServerSnapshot);
  const [filter, setFilter] = useState<"all" | "due_soon" | "overdue">("all");
  const [report, setReport] = useState<FeesAggregateReport | null>(null);

  const [newStudentOpen, setNewStudentOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [feeDialogStudentId, setFeeDialogStudentId] = useState<string | null>(null);
  const [feeAmount, setFeeAmount] = useState("");
  const [feeClassId, setFeeClassId] = useState<string>("");

  useEffect(() => {
    if (!isOwner) return;
    getFeesAggregateReport().then((r) => {
      if (!("error" in r)) setReport(r);
    });
  }, [isOwner]);

  const studentsById = new Map(students.map((s) => [s.id, s]));
  const feesByStudent = new Map<string, Fee[]>();
  for (const fee of fees) {
    const list = feesByStudent.get(fee.student_id) ?? [];
    list.push(fee);
    feesByStudent.set(fee.student_id, list);
  }

  const inSevenDays = today ? shiftLocalDate(today, 7) : null;
  const visibleStudents = !today
    ? []
    : students.filter((s) => {
        const studentFees = feesByStudent.get(s.id) ?? [];
        if (filter === "all") return true;
        if (filter === "overdue") return studentFees.some((f) => effectiveStatus(f, today) === "overdue");
        if (filter === "due_soon") {
          return studentFees.some(
            (f) => f.next_due_date && f.next_due_date >= today && inSevenDays && f.next_due_date <= inSevenDays
          );
        }
        return true;
      });

  async function handleCreateStudent(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    const { error: createError } = await createStudent({
      name: newName,
      phone: newPhone,
      email: newEmail || null,
    });
    setSaving(false);
    if (createError) {
      setError(createError);
      return;
    }
    setNewStudentOpen(false);
    setNewName("");
    setNewPhone("");
    setNewEmail("");
    router.refresh();
  }

  async function handleCreateFeePlan(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!feeDialogStudentId) return;
    setSaving(true);
    setError(null);
    const { error: createError } = await createFeePlan({
      studentId: feeDialogStudentId,
      classDefinitionId: feeClassId || null,
      amount: Number(feeAmount),
    });
    setSaving(false);
    if (createError) {
      setError(createError);
      return;
    }
    setFeeDialogStudentId(null);
    setFeeAmount("");
    setFeeClassId("");
    router.refresh();
  }

  async function handleRecordPayment(feeId: string, amount: number) {
    const { error: paymentError } = await recordCashPayment({ feeId, amount });
    if (paymentError) {
      setError(paymentError);
      return;
    }
    router.refresh();
  }

  return (
    <div className="space-y-4">
      {isOwner && report && (
        <div className="grid grid-cols-3 gap-4">
          <Card>
            <CardHeader>
              <CardDescription>Deuda vencida</CardDescription>
              <CardTitle className="text-2xl text-destructive">
                ${report.totalOverdue.toLocaleString("es-AR")}
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              {report.overdueCount} cuota{report.overdueCount === 1 ? "" : "s"} vencida{report.overdueCount === 1 ? "" : "s"}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardDescription>Cuotas al día</CardDescription>
              <CardTitle className="text-2xl">${report.totalActive.toLocaleString("es-AR")}</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">Facturación mensual activa</CardContent>
          </Card>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2">
          <Button variant={filter === "all" ? "default" : "outline"} size="sm" onClick={() => setFilter("all")}>
            Todos
          </Button>
          <Button variant={filter === "due_soon" ? "default" : "outline"} size="sm" onClick={() => setFilter("due_soon")}>
            Por vencer
          </Button>
          <Button variant={filter === "overdue" ? "default" : "outline"} size="sm" onClick={() => setFilter("overdue")}>
            Vencidos
          </Button>
        </div>
        <Button onClick={() => setNewStudentOpen(true)}>
          <Plus /> Nuevo alumno
        </Button>
      </div>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Alumno</TableHead>
            <TableHead>Teléfono</TableHead>
            <TableHead>Cuota</TableHead>
            <TableHead>Vencimiento</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead>Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {visibleStudents.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="text-center text-muted-foreground">
                No hay alumnos para mostrar.
              </TableCell>
            </TableRow>
          ) : (
            visibleStudents.map((student) => {
              const studentFees = feesByStudent.get(student.id) ?? [];
              const fee = studentFees[0];
              return (
                <TableRow key={student.id}>
                  <TableCell>{student.name}</TableCell>
                  <TableCell>{student.phone}</TableCell>
                  <TableCell>{fee ? `$${Number(fee.amount).toLocaleString("es-AR")}` : "—"}</TableCell>
                  <TableCell>{fee?.next_due_date ?? "—"}</TableCell>
                  <TableCell>
                    {fee ? (
                      <Badge variant={statusVariant[effectiveStatus(fee, today!)]}>
                        {statusLabel[effectiveStatus(fee, today!)]}
                      </Badge>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell className="flex gap-2">
                    {fee && (
                      <Button size="sm" variant="outline" onClick={() => handleRecordPayment(fee.id, Number(fee.amount))}>
                        Registrar pago
                      </Button>
                    )}
                    {isOwner && !fee && (
                      <Button size="sm" variant="outline" onClick={() => setFeeDialogStudentId(student.id)}>
                        Configurar cuota
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>

      <Dialog open={newStudentOpen} onOpenChange={setNewStudentOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nuevo alumno</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateStudent} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Nombre</Label>
              <Input required value={newName} onChange={(e) => setNewName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Teléfono</Label>
              <Input required value={newPhone} onChange={(e) => setNewPhone(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Email (opcional)</Label>
              <Input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} />
            </div>
            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
            <DialogFooter>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="animate-spin" />}
                Guardar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={feeDialogStudentId !== null} onOpenChange={(open) => !open && setFeeDialogStudentId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Configurar cuota — {studentsById.get(feeDialogStudentId ?? "")?.name}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateFeePlan} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Monto mensual</Label>
              <Input
                type="number"
                min={1}
                step="0.01"
                required
                value={feeAmount}
                onChange={(e) => setFeeAmount(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Clase (opcional)</Label>
              <Select value={feeClassId} onValueChange={setFeeClassId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="General" />
                </SelectTrigger>
                <SelectContent>
                  {classDefinitions.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
            <DialogFooter>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="animate-spin" />}
                Guardar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
