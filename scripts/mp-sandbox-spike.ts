// Gate #1 for the Mercado Pago recurring-billing integration (see the
// gimnasio/academia "Alumnos y Cuotas" plan). Confirms, with a real sandbox
// call, that creating a subscription (POST /preapproval) authenticated with
// a CONNECTED seller's own OAuth access token makes that seller the
// collector directly - not Lazzo's application account. This is NOT
// documented explicitly by Mercado Pago (their "Split Payments" marketplace
// feature is documented as unsupported for Subscriptions, but that's a
// different mechanism than simply using the seller's own token) - so this
// script is the empirical check before building anything else on top of the
// assumption.
//
// Usage:
//   npx tsx scripts/mp-sandbox-spike.ts
//
// Requires in .env.local: MERCADOPAGO_CLIENT_ID, MERCADOPAGO_CLIENT_SECRET.
//
// This script cannot complete the OAuth authorization step by itself - it
// requires a browser to log in and authorize the app (sandbox test users
// can't complete this login at all, confirmed empirically, so this must be
// done with a real Mercado Pago account; no real payment is ever processed,
// since the created subscription stays in "pending" status). It prints the
// authorization URL, then polls for the code captured by
// app/api/mercadopago/oauth/callback (the dev server must be running,
// reachable via the tunnel below).

import { config } from "dotenv";
import fs from "fs/promises";

config({ path: ".env.local" });

const CLIENT_ID = process.env.MERCADOPAGO_CLIENT_ID;
const CLIENT_SECRET = process.env.MERCADOPAGO_CLIENT_SECRET;
// Mercado Pago rejects plain http:// localhost redirect URIs (confirmed via
// a 403 on /authorization while testing this script) - an https tunnel
// (e.g. ngrok) forwarding to the local dev server is required even for
// local/manual testing. Must match exactly what's registered in the app's
// "URLs de redireccionamiento" panel.
const REDIRECT_URI =
  process.env.MERCADOPAGO_SPIKE_REDIRECT_URI ??
  "https://washstand-habitat-landside.ngrok-free.dev/api/mercadopago/oauth/callback";

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error("Missing MERCADOPAGO_CLIENT_ID / MERCADOPAGO_CLIENT_SECRET in .env.local");
  process.exit(1);
}

const CALLBACK_CAPTURE_FILE = "/tmp/mp-oauth-callback.json";

// The redirect_uri points at the app's real dev server (via an https tunnel,
// since Mercado Pago rejects plain http:// localhost redirect URIs) rather
// than a listener owned by this script - app/api/mercadopago/oauth/callback
// writes the received code/state/error to this file.
async function waitForOAuthCode(): Promise<string> {
  console.log(`Esperando el redirect de OAuth (polling ${CALLBACK_CAPTURE_FILE}) ...`);
  await fs.rm(CALLBACK_CAPTURE_FILE, { force: true });

  const deadline = Date.now() + 5 * 60 * 1000;
  while (Date.now() < deadline) {
    try {
      const raw = await fs.readFile(CALLBACK_CAPTURE_FILE, "utf-8");
      const { code, error } = JSON.parse(raw);
      if (code) return code;
      if (error) throw new Error(`OAuth authorization failed: ${error}`);
    } catch (err) {
      if (err instanceof Error && err.message.startsWith("OAuth authorization failed")) throw err;
      // file not written yet - keep polling
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error("Timed out waiting for OAuth redirect (5 minutes).");
}

async function exchangeCodeForToken(code: string) {
  const res = await fetch("https://api.mercadopago.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      grant_type: "authorization_code",
      code,
      redirect_uri: REDIRECT_URI,
    }),
  });

  if (!res.ok) {
    throw new Error(`Token exchange failed: ${res.status} ${await res.text()}`);
  }

  return res.json() as Promise<{
    access_token: string;
    refresh_token: string;
    user_id: number;
    public_key: string;
    expires_in: number;
  }>;
}

async function createTestPreapproval(sellerAccessToken: string, payerEmail?: string) {
  const payload: Record<string, unknown> = {
    reason: "Spike de verificacion - cuota mensual",
    external_reference: "spike-test",
    auto_recurring: {
      frequency: 1,
      frequency_type: "months",
      transaction_amount: 1000,
      currency_id: "ARS",
    },
    back_url: REDIRECT_URI,
    status: "pending",
  };
  if (payerEmail) payload.payer_email = payerEmail;

  const res = await fetch("https://api.mercadopago.com/preapproval", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${sellerAccessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const body = await res.json();
  if (!res.ok) {
    throw new Error(`preapproval creation failed: ${res.status} ${JSON.stringify(body)}`);
  }
  return body as { id: string; collector_id: number; status: string };
}

const TOKEN_CACHE_FILE = "/tmp/mp-spike-token-cache.json";

async function getCachedTokens(): Promise<{ access_token: string; user_id: number } | null> {
  try {
    const raw = await fs.readFile(TOKEN_CACHE_FILE, "utf-8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function main() {
  // Sandbox test users cannot complete the OAuth authorization_code login
  // flow at all (confirmed empirically: "la aplicación no puede conectarse a
  // tu cuenta" even with a correctly registered redirect_uri, matching known
  // Mercado Pago Connect limitations reported by other developers) - so this
  // step is done with the real developer account instead. No real payment
  // is ever processed (status stays "pending"), only collector_id attribution
  // is being checked, so this is safe.
  let tokens = await getCachedTokens();

  if (tokens) {
    console.log(`1) Reusando token cacheado de una corrida anterior (user_id=${tokens.user_id})`);
  } else {
    const authUrl =
      `https://auth.mercadopago.com/authorization?client_id=${CLIENT_ID}` +
      `&response_type=code&platform_id=mp&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&state=spike`;

    console.log("1) Completá el OAuth con tu cuenta REAL de Mercado Pago (no un usuario de prueba):");
    console.log(`   URL: ${authUrl}`);
    console.log("\n   Esperando el redirect...");

    const code = await waitForOAuthCode();
    console.log("   Codigo recibido, intercambiando por access token...");

    const fullTokens = await exchangeCodeForToken(code);
    console.log(`   Token obtenido para user_id=${fullTokens.user_id}`);
    tokens = { access_token: fullTokens.access_token, user_id: fullTokens.user_id };
    await fs.writeFile(TOKEN_CACHE_FILE, JSON.stringify(tokens));
  }

  console.log("\n2) Creando una suscripcion en estado pending con el token de la cuenta conectada...");
  // payer_email is required even for status=pending (confirmed: omitting it
  // returns 400 "payer_email is required"); a @testuser.com sandbox address
  // caused an unrelated 500 when paired with a real (non-test) collector
  // token, so a real-looking address is used instead - this subscription
  // never gets activated/charged, it only proves collector_id attribution.
  const preapproval = await createTestPreapproval(tokens.access_token, "valenbmza@gmail.com");

  console.log(`   preapproval.id=${preapproval.id} collector_id=${preapproval.collector_id} status=${preapproval.status}`);

  console.log("\n=== RESULTADO ===");
  if (preapproval.collector_id === tokens.user_id) {
    console.log(
      `PASS: el collector_id (${preapproval.collector_id}) es la cuenta conectada por OAuth (user_id=${tokens.user_id}), no la app de Lazzo.`
    );
    process.exit(0);
  } else {
    console.log(
      `FAIL: collector_id=${preapproval.collector_id} no coincide con la cuenta conectada (user_id=${tokens.user_id}).`
    );
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("\nERROR:", err.message);
  process.exit(1);
});
