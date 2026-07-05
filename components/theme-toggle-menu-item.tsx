"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";

export function ThemeToggleMenuItem() {
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
