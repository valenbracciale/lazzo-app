import {
  CalendarCheck,
  BellRing,
  PackageSearch,
  TriangleAlert,
  Wallet,
  LayoutGrid,
} from "lucide-react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";

const features = [
  {
    icon: CalendarCheck,
    title: "Reservas de tus clientes",
    description: "Agendá todo en un calendario simple, sin planillas ni cuadernos.",
  },
  {
    icon: BellRing,
    title: "Recordatorios automáticos",
    description: "Menos ausencias y menos cancelaciones de último momento.",
  },
  {
    icon: PackageSearch,
    title: "Control de stock en tiempo real",
    description: "Sabé siempre qué tenés y qué necesitás reponer.",
  },
  {
    icon: TriangleAlert,
    title: "Alertas de stock bajo",
    description: "Te avisamos antes de que te quedes sin lo que más vendés.",
  },
  {
    icon: Wallet,
    title: "Finanzas del día a día",
    description: "Ingresos, gastos y balance, sin planillas sueltas.",
  },
  {
    icon: LayoutGrid,
    title: "Todo en un solo lugar",
    description: "Sin cuadernos, sin Excel, sin perder el hilo de nada.",
  },
];

export function Features() {
  return (
    <section id="features" className="mx-auto max-w-6xl px-4 py-20">
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="text-3xl font-black tracking-tight text-(--landing-foreground)">
          Pensado para dueños de negocio, no para técnicos
        </h2>
        <p className="mt-3 text-(--landing-foreground-muted) text-pretty">
          Sin tiempo ni ganas de pelearte con software complicado. Lazzo hace
          lo esencial, simple y en un solo lugar.
        </p>
      </div>

      <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-3">
        {features.map(({ icon: Icon, title, description }) => (
          <Card key={title}>
            <CardHeader>
              <Icon className="mb-2 size-6 text-primary" />
              <CardTitle>{title}</CardTitle>
              <CardDescription>{description}</CardDescription>
            </CardHeader>
          </Card>
        ))}
      </div>
    </section>
  );
}
