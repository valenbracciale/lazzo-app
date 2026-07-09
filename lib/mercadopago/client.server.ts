import { createAdminClient } from "@/lib/supabase/admin";

// Every call in this module authenticates with the CONNECTED business's own
// OAuth access token (never Lazzo's own app-level credentials) - confirmed
// via scripts/mp-sandbox-spike.ts that this makes the connected business the
// `collector_id` on anything created, so money goes directly to them.
const REFRESH_BUFFER_MS = 10 * 60 * 1000;

type StoredTokens = { access_token: string; refresh_token: string; token_expires_at: string };

export async function storeConnection(
  businessId: string,
  tokens: {
    mp_user_id: string;
    access_token: string;
    refresh_token: string;
    public_key: string;
    scopes: string;
    expires_in: number;
  }
): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin.rpc("mp_store_connection", {
    p_business_id: businessId,
    p_mp_user_id: tokens.mp_user_id,
    p_access_token: tokens.access_token,
    p_refresh_token: tokens.refresh_token,
    p_public_key: tokens.public_key,
    p_scopes: tokens.scopes,
    p_expires_in: tokens.expires_in,
  });
  if (error) throw new Error(`Failed to store Mercado Pago connection: ${error.message}`);
}

async function getStoredTokens(businessId: string): Promise<StoredTokens | null> {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("mp_get_tokens", { p_business_id: businessId });
  if (error || !data || data.length === 0) return null;
  return data[0];
}

async function refreshAccessToken(businessId: string, refreshToken: string): Promise<StoredTokens> {
  const res = await fetch("https://api.mercadopago.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: process.env.MERCADOPAGO_CLIENT_ID,
      client_secret: process.env.MERCADOPAGO_CLIENT_SECRET,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });

  if (!res.ok) {
    throw new Error(`Failed to refresh Mercado Pago token: ${res.status} ${await res.text()}`);
  }

  const data = await res.json();
  await storeConnection(businessId, {
    mp_user_id: String(data.user_id),
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    public_key: data.public_key ?? "",
    scopes: data.scope ?? "",
    expires_in: data.expires_in,
  });

  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    token_expires_at: new Date(Date.now() + data.expires_in * 1000).toISOString(),
  };
}

export async function getValidAccessToken(businessId: string): Promise<string | null> {
  const stored = await getStoredTokens(businessId);
  if (!stored) return null;

  const expiresAt = new Date(stored.token_expires_at).getTime();
  if (expiresAt - Date.now() > REFRESH_BUFFER_MS) {
    return stored.access_token;
  }

  const refreshed = await refreshAccessToken(businessId, stored.refresh_token);
  return refreshed.access_token;
}

export async function createPreapproval(
  businessId: string,
  input: { amount: number; reason: string; payerEmail: string; externalReference: string }
): Promise<{ id: string; collector_id: number; status: string }> {
  const accessToken = await getValidAccessToken(businessId);
  if (!accessToken) {
    throw new Error("Este negocio no tiene conectada una cuenta de Mercado Pago.");
  }

  const res = await fetch("https://api.mercadopago.com/preapproval", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      reason: input.reason,
      external_reference: input.externalReference,
      payer_email: input.payerEmail,
      auto_recurring: {
        frequency: 1,
        frequency_type: "months",
        transaction_amount: input.amount,
        currency_id: "ARS",
      },
      back_url: `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/dashboard/students`,
      // Echoed back on every payment/subscription webhook event for this
      // preapproval - carries which business's own token to use to fetch
      // the event details, since the webhook payload itself has no way to
      // identify that.
      notification_url: `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/api/mercadopago/webhook?business_id=${businessId}`,
      status: "pending",
    }),
  });

  const body = await res.json();
  if (!res.ok) {
    throw new Error(`No pudimos crear la suscripción en Mercado Pago: ${JSON.stringify(body)}`);
  }
  return body;
}

export async function getPayment(businessId: string, paymentId: string) {
  const accessToken = await getValidAccessToken(businessId);
  if (!accessToken) return null;

  const res = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return null;
  return res.json();
}
