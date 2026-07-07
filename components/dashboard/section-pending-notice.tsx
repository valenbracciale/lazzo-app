import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export function SectionPendingNotice({
  sectionLabel,
}: {
  sectionLabel: string;
}) {
  return (
    <Card className="mx-auto max-w-md animate-in fade-in-0 duration-300">
      <CardHeader>
        <CardTitle>{sectionLabel} está en configuración</CardTitle>
        <CardDescription>
          Todavía no está lista para usarse. Hablá con el dueño del negocio
          para que termine de configurarla.
        </CardDescription>
      </CardHeader>
    </Card>
  );
}
