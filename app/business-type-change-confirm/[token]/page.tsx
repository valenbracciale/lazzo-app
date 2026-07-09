import { ConfirmButton } from "@/app/business-type-change-confirm/[token]/confirm-button";

export default async function BusinessTypeChangeConfirmPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="text-xl font-semibold">Confirmar cambio de tipo de negocio</h1>
      <p className="text-sm text-muted-foreground">
        Esta acción borra permanentemente toda la configuración y los datos operativos
        del tipo de negocio actual (reservas/turnos, profesionales, clases, alumnos,
        cuotas, etc.) y no se puede deshacer.
      </p>
      <ConfirmButton token={token} />
    </div>
  );
}
