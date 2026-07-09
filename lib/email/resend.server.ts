import { Resend } from "resend";

// Waitlist confirmation emails only - no other transactional email exists in
// this app (member invites go through Supabase Auth's own invite mechanism,
// which requires an account and can't produce a no-login link).
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
