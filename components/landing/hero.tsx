import Link from "next/link";
import { CalendarCheck, PackageSearch, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";

export async function Hero() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const isLoggedIn = !!data?.claims;

  return (
    <section className="mx-auto grid max-w-6xl gap-12 px-4 py-20 md:grid-cols-2 md:items-center md:py-28">
      <div className="space-y-6">
        <h1 className="text-4xl font-black tracking-tight text-balance text-(--landing-foreground) md:text-5xl">
          Tu negocio, bajo{" "}
          <span className="font-serif font-normal text-primary italic">control</span>, sin
          complicarte
        </h1>
        <p className="text-lg text-(--landing-foreground-muted) text-pretty">
          Lazzo es el panel para restaurantes, barberías, gimnasios, estudios
          de tatuaje y cualquier negocio que funcione con turnos, reservas o
          clases. Gestión de reservas, stock y finanzas, en un solo lugar —
          armado para que lo uses vos, no un técnico.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <Button asChild size="lg">
            <Link href={isLoggedIn ? "/dashboard" : "/login"}>
              {isLoggedIn ? "Ir a mi panel" : "Ya sos cliente, ingresá"}
            </Link>
          </Button>
        </div>
      </div>

      <div
        className="lazzo-glass lazzo-glass-panel relative rounded-2xl p-8"
        style={{
          backdropFilter: "var(--lazzo-glass-filter)",
          WebkitBackdropFilter: "var(--lazzo-glass-filter)",
        }}
      >
        <div className="grid gap-4">
          <div className="flex items-center gap-3 rounded-xl bg-card p-4 shadow-sm ring-1 ring-foreground/10">
            <CalendarCheck className="size-6 shrink-0 text-primary" />
            <div>
              <p className="text-sm font-bold">Reservas de hoy</p>
              <p className="text-sm text-muted-foreground">12 turnos confirmados</p>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-xl bg-card p-4 shadow-sm ring-1 ring-foreground/10">
            <PackageSearch className="size-6 shrink-0 text-primary" />
            <div>
              <p className="text-sm font-bold">Stock</p>
              <p className="text-sm text-muted-foreground">3 productos por agotarse</p>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-xl bg-card p-4 shadow-sm ring-1 ring-foreground/10">
            <Wallet className="size-6 shrink-0 text-primary" />
            <div>
              <p className="text-sm font-bold">Finanzas del día</p>
              <p className="text-sm text-muted-foreground">Balance actualizado al instante</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
