"use server";

import { headers } from "next/headers";
import { getCurrentBusiness } from "@/lib/business";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function inviteMember({
  name,
  email,
}: {
  name: string;
  email: string;
}): Promise<{ error?: string }> {
  const business = await getCurrentBusiness();
  if (business.role !== "owner") {
    return { error: "No tenés permiso para invitar encargados." };
  }

  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const ownerId = claims?.claims?.sub;

  const admin = createAdminClient();

  const { data: existing } = await admin
    .from("business_members")
    .select("business_id")
    .eq("email", email)
    .maybeSingle();

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
