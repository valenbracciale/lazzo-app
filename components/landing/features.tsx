import {
  CalendarCheck,
  BellRing,
  ShieldCheck,
  PackageSearch,
  Wallet,
  AlarmClock,
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
    description:
      "Tus clientes sacan su turno o hacen su reserva solos, cuando quieran. Vos ves todo en el panel — por día, semana o mes — sin tener que cargar nada a mano.",
  },
  {
    icon: BellRing,
    title: "Recordatorios automáticos",
    description: "Menos ausencias y menos cancelaciones de último momento.",
  },
  {
    icon: ShieldCheck,
    title: "Cada usuario ve lo que le corresponde",
    description:
      "Vos ves las finanzas completas. Tu encargado carga reservas y stock, pero no accede a los números. Cada profesional ve solo su propia agenda.",
  },
  {
    icon: PackageSearch,
    title: "Control de stock en tiempo real",
    description: "Sabé siempre qué tenés y qué necesitás reponer.",
  },
  {
    icon: Wallet,
    title: "Finanzas del día a día",
    description: "Ingresos, gastos y balance, sin planillas sueltas.",
  },
  {
    icon: AlarmClock,
    title: "No-shows detectados solos",
    description:
      "Si un cliente no llega, Lazzo lo marca automáticamente a los 15 minutos — sin que tengas que estar pendiente del reloj.",
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
          Sin cursos, sin manuales, sin ayuda técnica. Abrís Lazzo y ya sabés
          usarlo.
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
