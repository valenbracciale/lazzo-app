import { Resend } from "resend";

// Member invites go through Supabase Auth's own invite mechanism (requires
// an account). Everything here is transactional email that needs a
// no-login, click-to-confirm link instead.
const FROM_ADDRESS = "Lazzo <notificaciones@lazzo.app>";

function getClient(): Resend | null {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return null;
  return new Resend(apiKey);
}

export async function sendWaitlistSpotEmail(input: {
  to: string;
  studentName: string;
  className: string;
  classStartsAtLabel: string;
  confirmUrl: string;
}): Promise<{ error?: string }> {
  const client = getClient();
  if (!client) {
    return { error: "RESEND_API_KEY no está configurado." };
  }

  const { error } = await client.emails.send({
    from: FROM_ADDRESS,
    to: input.to,
    subject: `Se liberó un lugar en ${input.className}`,
    html: `
      <p>Hola ${input.studentName},</p>
      <p>Se liberó un lugar en <strong>${input.className}</strong> (${input.classStartsAtLabel}).</p>
      <p>Confirmá tu lugar antes de que se lo demos a otro alumno en espera:</p>
      <p><a href="${input.confirmUrl}">Confirmar mi lugar</a></p>
      <p>Este link vence en 24 horas.</p>
    `,
  });

  if (error) {
    return { error: error.message };
  }

  return {};
}

// SMS/WhatsApp comprobante is a planned future channel (no provider
// connected yet, per CLAUDE.md roadmap) - it would reuse this same
// `to`/`customerName`/`whenLabel`/`detailLabel` shape with a different
// transport instead of `client.emails.send`, so add it alongside this
// function rather than as a separate one-off when that provider exists.
export async function sendPublicBookingConfirmationEmail(input: {
  to: string;
  customerName: string;
  businessName: string;
  whenLabel: string;
  detailLabel: string;
  cancelUrl: string;
}): Promise<{ error?: string }> {
  const client = getClient();
  if (!client) {
    return { error: "RESEND_API_KEY no está configurado." };
  }

  const { error } = await client.emails.send({
    from: FROM_ADDRESS,
    to: input.to,
    subject: `Reserva confirmada en ${input.businessName}`,
    html: `
      <p>Hola ${input.customerName},</p>
      <p>Tu reserva en <strong>${input.businessName}</strong> quedó confirmada.</p>
      <p><strong>${input.whenLabel}</strong><br>${input.detailLabel}</p>
      <p>Si no podés ir, cancelá tu lugar desde este link:</p>
      <p><a href="${input.cancelUrl}">Cancelar mi reserva</a></p>
    `,
  });

  if (error) {
    return { error: error.message };
  }

  return {};
}

export async function sendBusinessTypeChangeEmail(input: {
  to: string;
  businessName: string;
  confirmUrl: string;
}): Promise<{ error?: string }> {
  const client = getClient();
  if (!client) {
    return { error: "RESEND_API_KEY no está configurado." };
  }

  const { error } = await client.emails.send({
    from: FROM_ADDRESS,
    to: input.to,
    subject: `Confirmá el cambio de tipo de negocio de ${input.businessName}`,
    html: `
      <p>Hola,</p>
      <p>Pediste cambiar el tipo de negocio de <strong>${input.businessName}</strong>.</p>
      <p><strong>Esta acción borra permanentemente toda la configuración y los datos operativos del tipo de negocio actual</strong> (reservas/turnos, profesionales, clases, alumnos, cuotas, etc. según corresponda) y no se puede deshacer.</p>
      <p>Si estás seguro, confirmá desde este link:</p>
      <p><a href="${input.confirmUrl}">Confirmar cambio de tipo de negocio</a></p>
      <p>Si no pediste este cambio, ignorá este email - no se va a borrar nada hasta que confirmes desde el link. Este link vence en 24 horas.</p>
    `,
  });

  if (error) {
    return { error: error.message };
  }

  return {};
}
