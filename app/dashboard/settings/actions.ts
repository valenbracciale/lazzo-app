"use server";

import { randomBytes } from "node:crypto";
import { headers } from "next/headers";
import { getCurrentBusiness } from "@/lib/business";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendBusinessTypeChangeEmail } from "@/lib/email/resend.server";

export async function inviteMember({
  name,
  email,
  professionalId,
}: {
  name: string;
  email: string;
  professionalId?: string | null;
}): Promise<{ error?: string }> {
  const business = await getCurrentBusiness();
  if (business.role !== "owner") {
    return { error: "No tenés permiso para invitar encargados." };
  }

  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const ownerId = claims?.claims?.sub;

  const admin = createAdminClient();

  const { data: existing, error: existingError } = await admin
    .from("business_members")
    .select("business_id")
    .eq("email", email)
    .maybeSingle();

  // Don't silently treat a failed lookup as "no conflict" - that would let
  // the invite proceed past the one guard that stops inviting someone who's
  // already an encargado at another business (v1 allows only one, forever).
  if (existingError) {
    return { error: "No pudimos validar el email. Probá de nuevo." };
  }

  if (existing && existing.business_id !== business.id) {
    return { error: "Este email ya pertenece a otro negocio." };
  }

  const headersList = await headers();
  const host = headersList.get("host");
  const protocol = host?.startsWith("localhost") ? "http" : "https";
  const origin = `${protocol}://${host}`;

  const { data: invited, error: inviteError } =
    await admin.auth.admin.inviteUserByEmail(email, {
      data: { name },
      redirectTo: `${origin}/accept-invite`,
    });

  if (inviteError || !invited.user) {
    return { error: "No pudimos enviar la invitación. Probá de nuevo." };
  }

  const { error: upsertError } = await admin
    .from("business_members")
    .upsert(
      {
        business_id: business.id,
        user_id: invited.user.id,
        name,
        email,
        professional_id: professionalId ?? null,
        status: "invited",
        invited_by: ownerId,
        invited_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );

  if (upsertError) {
    return { error: "No pudimos guardar la invitación. Probá de nuevo." };
  }

  return {};
}

export async function updatePublicBookingSettings(input: {
  slug: string;
  enabled: boolean;
  minAdvanceMinutes: number;
  maxAdvanceDays: number;
}): Promise<{ error?: string }> {
  const business = await getCurrentBusiness();
  if (business.role !== "owner") {
    return { error: "No tenés permiso para configurar la reserva pública." };
  }

  const slug = input.slug.trim().toLowerCase();
  if (!/^[a-z0-9-]{3,50}$/.test(slug)) {
    return {
      error: "El link solo puede tener letras minúsculas, números y guiones (3 a 50 caracteres).",
    };
  }
  if (input.minAdvanceMinutes < 0 || input.maxAdvanceDays <= 0) {
    return { error: "Revisá los valores de anticipación." };
  }

  // RLS would hide other businesses' rows from the caller's own session -
  // same reason inviteMember's cross-business email check uses the admin
  // client, above.
  const admin = createAdminClient();
  const { data: existing } = await admin
    .from("public_booking_settings")
    .select("business_id")
    .eq("slug", slug)
    .maybeSingle();

  if (existing && existing.business_id !== business.id) {
    return { error: "Ese link ya está en uso. Probá con otro." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("public_booking_settings").upsert(
    {
      business_id: business.id,
      slug,
      enabled: input.enabled,
      min_advance_minutes: input.minAdvanceMinutes,
      max_advance_days: input.maxAdvanceDays,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "business_id" }
  );

  if (error) {
    // Final authority against a race with another owner claiming the same
    // slug between the check above and this write.
    if (error.code === "23505") {
      return { error: "Ese link ya está en uso. Probá con otro." };
    }
    return { error: "No pudimos guardar la configuración. Probá de nuevo." };
  }

  return {};
}

export async function updateBusinessLogo(input: {
  logoUrl: string | null;
}): Promise<{ error?: string }> {
  const business = await getCurrentBusiness();
  if (business.role !== "owner") {
    return { error: "No tenés permiso para cambiar el logo." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("businesses")
    .update({ logo_url: input.logoUrl })
    .eq("id", business.id);

  if (error) {
    return { error: "No pudimos guardar el logo. Probá de nuevo." };
  }

  return {};
}

export async function requestBusinessTypeChange(): Promise<{ error?: string }> {
  const business = await getCurrentBusiness();
  if (business.role !== "owner") {
    return { error: "No tenés permiso para cambiar el tipo de negocio." };
  }
  if (!business.businessType) {
    return { error: "Este negocio todavía no tiene un tipo configurado." };
  }

  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const ownerId = claims?.claims?.sub;
  if (!ownerId) {
    return { error: "No pudimos identificar tu sesión. Volvé a intentarlo." };
  }

  const token = randomBytes(32).toString("base64url");

  const { error: insertError } = await supabase
    .from("business_type_change_requests")
    .insert({
      business_id: business.id,
      requested_by: ownerId,
      previous_business_type: business.businessType,
      token,
      expires_at: new Date(Date.now() + 24 * 60 * 60_000).toISOString(),
    });

  if (insertError) {
    return { error: "No pudimos iniciar el cambio. Probá de nuevo." };
  }

  const headersList = await headers();
  const host = headersList.get("host");
  const protocol = host?.startsWith("localhost") ? "http" : "https";
  const confirmUrl = `${protocol}://${host}/business-type-change-confirm/${token}`;

  const { error: emailError } = await sendBusinessTypeChangeEmail({
    to: business.email,
    businessName: business.name,
    confirmUrl,
  });

  if (emailError) {
    return { error: `No pudimos enviar el email de confirmación: ${emailError}` };
  }

  return {};
}
