"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, Package, Wallet } from "lucide-react";
import { Logo } from "@/components/landing/logo";
import { Badge } from "@/components/ui/badge";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

const navItems = [
  { href: "/dashboard/reservations", label: "Reservas", icon: CalendarDays },
  { href: null, label: "Stock", icon: Package },
  { href: null, label: "Finanzas", icon: Wallet },
];

export function DashboardSidebar() {
  const pathname = usePathname();

  return (
    <Sidebar>
      <SidebarHeader>
        <Link href="/dashboard/reservations" className="flex items-center px-2 py-1.5">
          <Logo className="h-7 w-auto" />
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.label}>
                  {item.href ? (
                    <SidebarMenuButton asChild isActive={pathname.startsWith(item.href)}>
                      <Link href={item.href}>
                        <item.icon />
                        <span>{item.label}</span>
                      </Link>
                    </SidebarMenuButton>
                  ) : (
                    <SidebarMenuButton disabled className="cursor-not-allowed">
                      <item.icon />
                      <span>{item.label}</span>
                      <Badge variant="outline" className="ml-auto text-[10px]">
                        Próximamente
                      </Badge>
                    </SidebarMenuButton>
                  )}
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
