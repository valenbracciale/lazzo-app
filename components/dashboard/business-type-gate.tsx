"use client";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useOnboarding } from "@/components/dashboard/onboarding-flow";

export function BusinessTypeGate() {
  const { openOnboarding } = useOnboarding();

  return (
    <Card className="mx-auto max-w-md animate-in fade-in-0 duration-300">
      <CardHeader>
        <CardTitle>Primero configurá tu negocio</CardTitle>
        <CardDescription>
          Antes de usar esta sección necesitamos saber qué tipo de negocio
          tenés.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button onClick={openOnboarding}>Configurar mi negocio</Button>
      </CardContent>
    </Card>
  );
}
