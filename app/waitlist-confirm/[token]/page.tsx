import { ConfirmButton } from "@/app/waitlist-confirm/[token]/confirm-button";

export default async function WaitlistConfirmPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="text-xl font-semibold">Se liberó un lugar en tu clase</h1>
      <p className="text-sm text-muted-foreground">
        Confirmá tu lugar antes de que se lo demos a otro alumno en espera.
      </p>
      <ConfirmButton token={token} />
    </div>
  );
}
