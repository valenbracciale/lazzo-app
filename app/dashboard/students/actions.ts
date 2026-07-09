"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentBusiness } from "@/lib/business";
import { createPreapproval } from "@/lib/mercadopago/client.server";

export type Student = { id: string; name: string; phone: string; email: string | null };

export async function searchStudents(query: string): Promise<Student[]> {
  const business = await getCurrentBusiness();
  const supabase = await createClient();

  if (!query.trim()) return [];

  const { data } = await supabase
    .from("students")
    .select("id, name, phone, email")
    .eq("business_id", business.id)
    .or(`name.ilike.%${query}%,phone.ilike.%${query}%`)
    .order("name", { ascending: true })
    .limit(10);

  return data ?? [];
}

export async function createStudent(input: {
  name: string;
  phone: string;
  email: string | null;
}): Promise<{ student?: Student; error?: string }> {
  const business = await getCurrentBusiness();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("students")
    .insert({
      business_id: business.id,
      name: input.name,
      phone: input.phone,
      email: input.email,
    })
    .select("id, name, phone, email")
    .single();

  if (error || !data) {
    return { error: "No pudimos guardar el alumno. Probá de nuevo." };
  }

  return { student: data };
}

export async function createFeePlan(input: {
  studentId: string;
  classDefinitionId: string | null;
  amount: number;
}): Promise<{ error?: string }> {
  const business = await getCurrentBusiness();
  if (business.role !== "owner") {
    return { error: "No tenés permiso para configurar cuotas." };
  }

  const supabase = await createClient();

  const { data: student } = await supabase
    .from("students")
    .select("email")
    .eq("id", input.studentId)
    .maybeSingle();

  const { data: fee, error } = await supabase
    .from("student_fees")
    .insert({
      business_id: business.id,
      student_id: input.studentId,
      class_definition_id: input.classDefinitionId,
      amount: input.amount,
      status: "pending",
      next_due_date: new Date().toISOString().slice(0, 10),
    })
    .select("id")
    .single();

  if (error || !fee) {
    return { error: "No pudimos guardar la cuota. Probá de nuevo." };
  }

  // A Mercado Pago subscription requires the student's email as payer_email.
  // Without one, the fee stays tracked manually (cash payments only) until an
  // email is added - this never blocks saving the fee itself.
  // external_reference is this fee row's own id, so the webhook can map an
  // incoming payment/subscription event back to it unambiguously.
  if (student?.email) {
    try {
      const preapproval = await createPreapproval(business.id, {
        amount: input.amount,
        reason: `Cuota mensual - ${business.name}`,
        payerEmail: student.email,
        externalReference: fee.id,
      });
      await supabase
        .from("student_fees")
        .update({
          mp_preapproval_id: preapproval.id,
          mp_collector_id: String(preapproval.collector_id),
        })
        .eq("id", fee.id);
    } catch {
      // Mercado Pago not connected yet, or the API call failed - the fee
      // record is already saved; the owner can connect/retry later.
    }
  }

  return {};
}

export async function recordCashPayment(input: {
  feeId: string;
  amount: number;
}): Promise<{ error?: string }> {
  const business = await getCurrentBusiness();
  const supabase = await createClient();

  const { error: paymentError } = await supabase.from("fee_payments").insert({
    business_id: business.id,
    fee_id: input.feeId,
    amount: input.amount,
    status: "cash",
    paid_at: new Date().toISOString(),
  });

  if (paymentError) {
    return { error: "No pudimos registrar el pago. Probá de nuevo." };
  }

  if (business.role === "owner") {
    const nextDue = new Date();
    nextDue.setMonth(nextDue.getMonth() + 1);
    await supabase
      .from("student_fees")
      .update({ status: "active", next_due_date: nextDue.toISOString().slice(0, 10) })
      .eq("id", input.feeId);
  }

  return {};
}

export type FeesAggregateReport = {
  totalOverdue: number;
  totalActive: number;
  overdueCount: number;
};

export async function getFeesAggregateReport(): Promise<FeesAggregateReport | { error: string }> {
  const business = await getCurrentBusiness();
  if (business.role !== "owner") {
    return { error: "No tenés permiso para ver reportes agregados." };
  }

  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);

  const { data: fees } = await supabase
    .from("student_fees")
    .select("amount, status, next_due_date")
    .eq("business_id", business.id)
    .neq("status", "cancelled");

  let totalOverdue = 0;
  let totalActive = 0;
  let overdueCount = 0;

  for (const fee of fees ?? []) {
    const isOverdue = fee.next_due_date !== null && fee.next_due_date < today;
    if (isOverdue) {
      totalOverdue += Number(fee.amount);
      overdueCount += 1;
    } else if (fee.status === "active") {
      totalActive += Number(fee.amount);
    }
  }

  return { totalOverdue, totalActive, overdueCount };
}
