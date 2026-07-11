import { CheckCircle2 } from "lucide-react";

export function BookingSuccess({ businessName }: { businessName: string }) {
  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md flex-col items-center justify-center gap-4 px-4 text-center">
      <CheckCircle2 className="size-12 text-primary" />
      <h1 className="text-xl font-semibold">¡Reserva confirmada!</h1>
      <p className="text-sm text-muted-foreground">
        Te esperamos en {businessName}. Te mandamos un email con los detalles y un link para
        cancelar si no podés ir.
      </p>
    </div>
  );
}
