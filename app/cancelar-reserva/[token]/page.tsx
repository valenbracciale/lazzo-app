import { notFound } from "next/navigation";
import { getCancelBookingDetails } from "@/app/cancelar-reserva/[token]/actions";
import { CancelButton } from "@/app/cancelar-reserva/[token]/cancel-button";

export default async function CancelBookingPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const details = await getCancelBookingDetails(token);
  if (!details) notFound();

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="text-xl font-semibold">Cancelar reserva</h1>
      <p className="text-sm text-muted-foreground">{details.businessName}</p>
      <div className="rounded-lg border px-4 py-3 text-sm">
        <p className="font-medium">{details.whenLabel}</p>
        <p className="text-muted-foreground">{details.detailLabel}</p>
      </div>

      {details.alreadyCancelled ? (
        <p className="text-sm text-muted-foreground">
          Este turno ya no se puede cancelar (ya fue cancelado o ya pasó).
        </p>
      ) : (
        <CancelButton token={token} />
      )}
    </div>
  );
}
