import crypto from "crypto";

// Signs/verifies the OAuth "state" param for the Mercado Pago connect flow -
// proves the callback belongs to a request this app actually started, and
// carries which business it's for, without needing a separate pending-state
// table.
function hmac(value: string): string {
  return crypto
    .createHmac("sha256", process.env.MERCADOPAGO_STATE_SECRET!)
    .update(value)
    .digest("base64url");
}

export function signState(businessId: string): string {
  const nonce = crypto.randomBytes(16).toString("base64url");
  const payload = `${businessId}.${nonce}`;
  return `${payload}.${hmac(payload)}`;
}

export function verifyState(state: string): string | null {
  const parts = state.split(".");
  if (parts.length !== 3) return null;
  const [businessId, nonce, signature] = parts;
  const payload = `${businessId}.${nonce}`;
  const expected = hmac(payload);

  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

  return businessId;
}
