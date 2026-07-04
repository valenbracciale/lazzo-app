"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Logo } from "@/components/landing/logo";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

const navLinks = [
  { href: "#features", label: "Funciones" },
  { href: "#footer", label: "Contacto" },
];

function ThemeToggleMenuItem() {
  const { resolvedTheme, setTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  return (
    <DropdownMenuItem
      onSelect={(event) => {
        event.preventDefault();
        setTheme(isDark ? "light" : "dark");
      }}
    >
      {isDark ? <Sun /> : <Moon />}
      Modo oscuro
    </DropdownMenuItem>
  );
}

function ThemeToggleMobileItem() {
  const { resolvedTheme, setTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className="flex items-center gap-2 text-left"
    >
      {isDark ? <Sun className="size-4" /> : <Moon className="size-4" />}
      Modo oscuro
    </button>
  );
}

export function HeaderClient({ email }: { email: string | null }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header
      className="lazzo-glass lazzo-glass-header sticky top-0 z-40"
      style={{
        backdropFilter: "var(--lazzo-glass-filter)",
        WebkitBackdropFilter: "var(--lazzo-glass-filter)",
      }}
    >
      <svg className="absolute size-0" aria-hidden="true">
        <filter id="lazzo-glass" x="-20%" y="-20%" width="140%" height="140%">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.008 0.02"
            numOctaves="2"
            seed="7"
            result="noise"
          />
          <feDisplacementMap
            in="SourceGraphic"
            in2="noise"
            scale="30"
            xChannelSelector="R"
            yChannelSelector="G"
          />
        </filter>
      </svg>
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
        <Link href="/">
          <Logo />
        </Link>

        <nav className="hidden items-center gap-6 text-sm text-(--landing-foreground-muted) md:flex">
          {navLinks.map((link) => (
            <a key={link.href} href={link.href} className="hover:text-(--landing-foreground)">
              {link.label}
            </a>
          ))}
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          {email ? (
            <>
              <Button asChild variant="secondary" size="sm">
                <Link href="/dashboard">Ir a mi panel</Link>
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="outline-none">
                    <Avatar>
                      <AvatarFallback>
                        {email.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem asChild>
                    <Link href="/account/change-password">Cambiar contraseña</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/account/change-email">Cambiar email</Link>
                  </DropdownMenuItem>
                  <ThemeToggleMenuItem />
                  <DropdownMenuItem asChild variant="destructive">
                    <Link href="/logout">Cerrar sesión</Link>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : (
            <Button asChild>
              <Link href="/login">Iniciar sesión</Link>
            </Button>
          )}
        </div>

        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="md:hidden">
              <Menu />
              <span className="sr-only">Abrir menú</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="right">
            <SheetHeader>
              <SheetTitle asChild>
                <Logo />
              </SheetTitle>
            </SheetHeader>
            <nav className="flex flex-col gap-4 px-4 text-sm">
              {navLinks.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileOpen(false)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  {link.label}
                </a>
              ))}
              {email ? (
                <>
                  <Button asChild onClick={() => setMobileOpen(false)}>
                    <Link href="/dashboard">Ir a mi panel</Link>
                  </Button>
                  <Link href="/account/change-password" onClick={() => setMobileOpen(false)}>
                    Cambiar contraseña
                  </Link>
                  <Link href="/account/change-email" onClick={() => setMobileOpen(false)}>
                    Cambiar email
                  </Link>
                  <ThemeToggleMobileItem />
                  <Link href="/logout" onClick={() => setMobileOpen(false)}>
                    Cerrar sesión
                  </Link>
                </>
              ) : (
                <Button asChild onClick={() => setMobileOpen(false)}>
                  <Link href="/login">Iniciar sesión</Link>
                </Button>
              )}
            </nav>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  );
}
