import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export function MercadoPagoSettings({
  connected,
  authUrl,
}: {
  connected: boolean;
  authUrl: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Mercado Pago</CardTitle>
        <CardDescription>
          Conectá tu cuenta de Mercado Pago para cobrar las cuotas de tus alumnos
          directamente en tu cuenta - Lazzo nunca retiene el dinero.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {connected ? (
          <Badge>Cuenta conectada</Badge>
        ) : (
          <Button asChild>
            <a href={authUrl}>Conectar Mercado Pago</a>
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
