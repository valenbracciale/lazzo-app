import { Globe, MessageCircle, Mail } from "lucide-react";
import { Logo } from "@/components/landing/logo";

const columns = [
  {
    title: "Producto",
    links: [
      { label: "Funciones", href: "#features" },
      { label: "Iniciar sesión", href: "/login" },
    ],
  },
  {
    title: "Compañía",
    links: [
      { label: "Sobre Lazzo", href: "#" },
      { label: "Contacto", href: "#" },
    ],
  },
  {
    title: "Legal",
    links: [
      { label: "Términos", href: "#" },
      { label: "Privacidad", href: "#" },
    ],
  },
];

export function Footer() {
  return (
    <footer id="footer" className="border-t border-white/15">
      <div className="mx-auto max-w-6xl px-4 py-12">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
          <div>
            <Logo />
            <p className="mt-2 text-sm text-(--landing-foreground-muted)">
              Reservas, stock y finanzas de tu negocio, en un solo lugar.
            </p>
          </div>

          {columns.map((column) => (
            <div key={column.title}>
              <p className="text-sm font-bold text-(--landing-foreground)">{column.title}</p>
              <ul className="mt-3 space-y-2">
                {column.links.map((link) => (
                  <li key={link.label}>
                    <a
                      href={link.href}
                      className="text-sm text-(--landing-foreground-muted) hover:text-(--landing-foreground)"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-10 flex flex-col-reverse items-center gap-4 border-t border-white/15 pt-6 md:flex-row md:justify-between">
          <p className="text-sm text-(--landing-foreground-muted)">
            &copy; {new Date().getFullYear()} Lazzo. Todos los derechos reservados.
          </p>
          <div className="flex items-center gap-4 text-(--landing-foreground-muted)">
            <a href="#" aria-label="Sitio web" className="hover:text-(--landing-foreground)">
              <Globe className="size-5" />
            </a>
            <a href="#" aria-label="WhatsApp" className="hover:text-(--landing-foreground)">
              <MessageCircle className="size-5" />
            </a>
            <a href="#" aria-label="Email" className="hover:text-(--landing-foreground)">
              <Mail className="size-5" />
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
