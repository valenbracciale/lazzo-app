import type { Metadata } from "next";
import { Poppins, Instrument_Serif } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["400", "700", "900"],
});

const instrumentSerif = Instrument_Serif({
  variable: "--font-instrument-serif",
  subsets: ["latin"],
  style: ["italic"],
  weight: ["400"],
});

export const metadata: Metadata = {
  title: "Lazzo — Tu negocio, bajo control",
  description:
    "Reservas, stock y finanzas de tu negocio en un solo lugar, sin planillas ni complicaciones.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${poppins.variable} ${instrumentSerif.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      {/* theme-locked-light by default: body's own `bg-background` (globals.css)
          is an ancestor of every page, so locking only a child wrapper still
          lets the true --background leak through at body's own edges. The
          dashboard is the one subtree that should react to the toggle - it
          removes this class itself (see UnlockTheme) while mounted. */}
      <body className="theme-locked-light min-h-full flex flex-col">
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
          <TooltipProvider>{children}</TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
