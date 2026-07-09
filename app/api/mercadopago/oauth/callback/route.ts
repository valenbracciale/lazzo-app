import { NextRequest } from "next/server";
import { redirect } from "next/navigation";
import { verifyState } from "@/lib/mercadopago/state.server";
import { storeConnection } from "@/lib/mercadopago/client.server";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const error = request.nextUrl.searchParams.get("error");

  if (error || !code || !state) {
    redirect("/dashboard/settings?mp=error");
  }

  const businessId = verifyState(state);
  if (!businessId) {
    redirect("/dashboard/settings?mp=error");
  }

  const host = request.headers.get("host");
  const protocol = host?.startsWith("localhost") ? "http" : "https";
  const redirectUri = `${protocol}://${host}/api/mercadopago/oauth/callback`;

  const tokenRes = await fetch("https://api.mercadopago.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: process.env.MERCADOPAGO_CLIENT_ID,
      client_secret: process.env.MERCADOPAGO_CLIENT_SECRET,
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
    }),
  });

  if (!tokenRes.ok) {
    redirect("/dashboard/settings?mp=error");
  }

  const tokens = await tokenRes.json();

  await storeConnection(businessId, {
    mp_user_id: String(tokens.user_id),
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    public_key: tokens.public_key ?? "",
    scopes: tokens.scope ?? "",
    expires_in: tokens.expires_in,
  });

  redirect("/dashboard/settings?mp=connected");
}
