"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { ThemeToggleMenuItem } from "@/components/theme-toggle-menu-item";
import { createClient } from "@/lib/supabase/client";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function DashboardHeader({
  businessName,
  email,
}: {
  businessName: string;
  email: string;
}) {
  const router = useRouter();

  // A plain <Link href="/logout"> to a GET route with a side effect gets
  // prefetched by Next.js in production the moment this menu item enters the
  // viewport, signing the user out without a click - and a bare GET with no
  // token is also forgeable via e.g. an <img> tag from another origin. Signing
  // out client-side on an explicit click (same pattern as the landing header)
  // avoids both.
  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
  }

  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-4 border-b border-border px-4">
      <div className="flex items-center gap-2">
        <SidebarTrigger />
        <span className="font-semibold">{businessName}</span>
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="outline-none">
            <Avatar>
              <AvatarFallback>{email.charAt(0).toUpperCase()}</AvatarFallback>
            </Avatar>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem asChild>
            <Link href="/account/change-password">Cambiar contraseña</Link>
          </DropdownMenuItem>
          <ThemeToggleMenuItem />
          <DropdownMenuItem asChild>
            <Link href="/">Salir de mi panel</Link>
          </DropdownMenuItem>
          <DropdownMenuItem variant="destructive" onSelect={handleLogout}>
            Cerrar sesión
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
