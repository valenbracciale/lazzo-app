import { NextRequest } from "next/server";
import crypto from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPayment } from "@/lib/mercadopago/client.server";

// Single shared endpoint for every connected business - Mercado Pago calls
// this one registered URL for all of them. Disambiguated via the
// `business_id` query param (set on notification_url at preapproval-creation
// time, see lib/mercadopago/client.server.ts) and the fee itself is resolved
// via `external_reference` (set to the local student_fees.id), never by
// looking up ids on Mercado Pago's side.
function isValidSignature(request: NextRequest, dataId: string): boolean {
  const secret = process.env.MERCADOPAGO_WEBHOOK_SECRET;
  if (!secret) {
    console.warn("MERCADOPAGO_WEBHOOK_SECRET not set - skipping signature validation.");
    return true;
  }

  const signatureHeader = request.headers.get("x-signature");
  const requestId = request.headers.get("x-request-id");
  if (!signatureHeader || !requestId) return false;

  const parts = Object.fromEntries(
    signatureHeader.split(",").map((p) => p.trim().split("=") as [string, string])
  );
  const ts = parts.ts;
  const v1 = parts.v1;
  if (!ts || !v1) return false;

  const manifest = `id:${dataId};request-id:${requestId};ts:${ts};`;
  const expected = crypto.createHmac("sha256", secret).update(manifest).digest("hex");

  const a = Buffer.from(v1);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export async function POST(request: NextRequest) {
  const businessId = request.nextUrl.searchParams.get("business_id");
  const body = await request.json().catch(() => null);

  const dataId: string | undefined = body?.data?.id ?? request.nextUrl.searchParams.get("data.id") ?? undefined;
  const type: string | undefined = body?.type ?? request.nextUrl.searchParams.get("type") ?? undefined;

  if (!businessId || !dataId || !type) {
    return new Response("ignored", { status: 200 });
  }

  if (!isValidSignature(request, dataId)) {
    return new Response("invalid signature", { status: 401 });
  }

  if (type === "payment") {
    const payment = await getPayment(businessId, dataId);
    const feeId = payment?.external_reference;
    if (payment && feeId) {
      const admin = createAdminClient();
      // The `sync_student_fee_after_payment` trigger on fee_payments advances
      // the linked student_fees row (status + next_due_date) when this insert
      // lands with status "approved".
      await admin.from("fee_payments").insert({
        business_id: businessId,
        fee_id: feeId,
        mp_payment_id: String(payment.id),
        amount: payment.transaction_amount,
        status: payment.status === "approved" ? "approved" : "pending",
        paid_at: payment.status === "approved" ? payment.date_approved : null,
        raw_webhook: payment,
      });
    }
  }

  return new Response("ok", { status: 200 });
}
