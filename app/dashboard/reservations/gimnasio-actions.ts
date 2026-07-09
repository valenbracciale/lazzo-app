"use server";

import { createClient } from "@/lib/supabase/server";

const CLASS_FULL_ERROR = "class_full";
const GENERIC_ERROR = "No pudimos guardar la inscripción. Probá de nuevo.";

export async function enrollStudentPunctual(input: {
  classInstanceId: string;
  studentId: string;
}): Promise<{ error?: string; classFull?: boolean }> {
  const supabase = await createClient();

  const { error } = await supabase.rpc("enroll_student_punctual", {
    p_instance_id: input.classInstanceId,
    p_student_id: input.studentId,
  });

  if (error) {
    if (error.message?.includes(CLASS_FULL_ERROR)) {
      return { classFull: true };
    }
    return { error: GENERIC_ERROR };
  }

  return {};
}

export async function enrollStudentRecurring(input: {
  classDefinitionId: string;
  studentId: string;
}): Promise<{ error?: string; classFull?: boolean }> {
  const supabase = await createClient();

  const { error } = await supabase.rpc("enroll_student_recurring", {
    p_class_definition_id: input.classDefinitionId,
    p_student_id: input.studentId,
  });

  if (error) {
    if (error.message?.includes(CLASS_FULL_ERROR)) {
      return { classFull: true };
    }
    return { error: GENERIC_ERROR };
  }

  return {};
}

export async function joinWaitlist(input: {
  classInstanceId: string;
  studentId: string;
}): Promise<{ error?: string }> {
  const supabase = await createClient();

  const { data: business } = await supabase
    .from("class_instances")
    .select("business_id")
    .eq("id", input.classInstanceId)
    .maybeSingle();

  if (!business) {
    return { error: GENERIC_ERROR };
  }

  const { error } = await supabase.from("waitlist_entries").insert({
    business_id: business.business_id,
    class_instance_id: input.classInstanceId,
    student_id: input.studentId,
    status: "waiting",
  });

  if (error) {
    if (error.code === "23505") {
      return { error: "Este alumno ya está en la lista de espera de esta clase." };
    }
    return { error: GENERIC_ERROR };
  }

  return {};
}
