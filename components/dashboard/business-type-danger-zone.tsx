"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";
import { requestBusinessTypeChange } from "@/app/dashboard/settings/actions";

export function BusinessTypeDangerZone() {
  const [open, setOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConfirm() {
    setSending(true);
    setError(null);
    const { error: requestError } = await requestBusinessTypeChange();
    setSending(false);

    if (requestError) {
      setError(requestError);
      return;
    }
    setSent(true);
  }

  return (
    <Card className="border-destructive/50">
      <CardHeader>
        <CardTitle>Zona de peligro</CardTitle>
        <CardDescription>
          Cambiar el tipo de negocio borra permanentemente la configuración y los datos
          operativos actuales.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button variant="destructive" onClick={() => setOpen(true)}>
          Cambiar tipo de negocio
        </Button>
      </CardContent>

      <Dialog
        open={open}
        onOpenChange={(nextOpen) => {
          setOpen(nextOpen);
          if (!nextOpen) {
            setSent(false);
            setError(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Cambiar el tipo de negocio?</DialogTitle>
            <DialogDescription>
              Esta acción borra permanentemente toda la configuración y los datos
              operativos del tipo de negocio actual (reservas/turnos, profesionales,
              clases, alumnos, cuotas, etc. según corresponda) y no se puede deshacer.
            </DialogDescription>
          </DialogHeader>

          {sent ? (
            <p className="text-sm font-medium text-primary">
              Te enviamos un email de confirmación. El cambio no se ejecuta hasta que lo
              confirmes desde ese link.
            </p>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                Si confirmás, te vamos a mandar un email con un link. No se borra nada
                hasta que lo confirmes ahí.
              </p>
              {error && (
                <p role="alert" className="text-sm text-destructive">
                  {error}
                </p>
              )}
            </>
          )}

          <DialogFooter>
            {sent ? (
              <Button onClick={() => setOpen(false)}>Cerrar</Button>
            ) : (
              <>
                <Button variant="outline" onClick={() => setOpen(false)} disabled={sending}>
                  Cancelar
                </Button>
                <Button variant="destructive" onClick={handleConfirm} disabled={sending}>
                  {sending && <Loader2 className="animate-spin" />}
                  {sending ? "Enviando..." : "Sí, enviarme el email de confirmación"}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
