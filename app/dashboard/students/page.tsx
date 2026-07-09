import { redirect } from "next/navigation";
import { getCurrentBusiness } from "@/lib/business";
import { createClient } from "@/lib/supabase/server";
import { StudentsView } from "@/components/dashboard/students-view";

export default async function StudentsPage() {
  const business = await getCurrentBusiness();

  if (business.businessType !== "gimnasio_academia") {
    redirect("/dashboard/reservations");
  }

  const supabase = await createClient();

  const [{ data: students }, { data: fees }, { data: classDefinitions }] = await Promise.all([
    supabase
      .from("students")
      .select("id, name, phone, email")
      .eq("business_id", business.id)
      .order("name", { ascending: true }),
    supabase
      .from("student_fees")
      .select("id, student_id, class_definition_id, amount, status, next_due_date")
      .eq("business_id", business.id),
    supabase
      .from("class_definitions")
      .select("id, name")
      .eq("business_id", business.id)
      .order("name", { ascending: true }),
  ]);

  return (
    <StudentsView
      students={students ?? []}
      fees={fees ?? []}
      classDefinitions={classDefinitions ?? []}
      isOwner={business.role === "owner"}
    />
  );
}
