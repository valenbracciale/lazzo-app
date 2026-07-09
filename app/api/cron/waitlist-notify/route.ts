import { NextRequest } from "next/server";
import crypto from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendWaitlistSpotEmail } from "@/lib/email/resend.server";

const TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

// This route runs server-side (Vercel serverless, likely UTC) - unlike
// lib/datetime.ts (browser-only, relies on the runtime's local timezone),
// class start times must be formatted with an explicit Argentina timezone.
function formatArgentinaDateTime(iso: string): string {
  return new Date(iso).toLocaleString("es-AR", {
    timeZone: "America/Argentina/Buenos_Aires",
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const supabase = createAdminClient();

  const { data: entries } = await supabase
    .from("waitlist_entries")
    .select(
      "id, class_instance_id, student_id, students(name, email), class_instances(starts_at, class_definitions(name))"
    )
    .eq("status", "pending_notify");

  let notified = 0;

  for (const entry of entries ?? []) {
    const student = entry.students as unknown as { name: string; email: string | null } | null;
    const instance = entry.class_instances as unknown as {
      starts_at: string;
      class_definitions: { name: string } | null;
    } | null;

    if (!student?.email || !instance) {
      // No email on file - can't notify; leave as pending_notify for manual follow-up.
      continue;
    }

    const token = crypto.randomBytes(32).toString("base64url");
    const tokenExpiresAt = new Date(Date.now() + TOKEN_TTL_MS).toISOString();

    const { error: updateError } = await supabase
      .from("waitlist_entries")
      .update({
        token,
        token_expires_at: tokenExpiresAt,
        status: "notified",
        notified_at: new Date().toISOString(),
      })
      .eq("id", entry.id)
      .eq("status", "pending_notify");

    if (updateError) continue;

    const host = request.headers.get("host");
    const protocol = host?.startsWith("localhost") ? "http" : "https";
    const confirmUrl = `${protocol}://${host}/waitlist-confirm/${token}`;

    await sendWaitlistSpotEmail({
      to: student.email,
      studentName: student.name,
      className: instance.class_definitions?.name ?? "tu clase",
      classStartsAtLabel: formatArgentinaDateTime(instance.starts_at),
      confirmUrl,
    });

    notified += 1;
  }

  return Response.json({ notified });
}
