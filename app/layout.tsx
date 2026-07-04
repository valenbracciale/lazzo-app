import type { Metadata } from "next";
import { Poppins, Instrument_Serif } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
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
      {/* theme-locked-light: no page today (landing or auth) should react to
          the new theme toggle yet, since there's no real dashboard for it to
          apply to. Remove this once a dashboard route should start honoring
          the toggle - the provider/persistence underneath are already real. */}
      <body className="theme-locked-light min-h-full flex flex-col">
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
