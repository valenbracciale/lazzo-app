import Link from "next/link";
import { Logo } from "@/components/landing/logo";

export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="landing flex flex-1 flex-col">
      <main className="flex flex-1 flex-col items-center justify-center gap-6 px-4 py-16">
        <Link href="/">
          <Logo />
        </Link>
        <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-8 shadow-lg">
          {children}
        </div>
      </main>
    </div>
  );
}
