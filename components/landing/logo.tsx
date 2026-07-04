import Image from "next/image";

export function Logo({ className = "h-8 w-auto" }: { className?: string }) {
  return (
    <Image
      src="/logo/lazzo-completo-color-nuevo.svg"
      alt="Lazzo"
      width={142}
      height={48}
      priority
      className={className}
    />
  );
}
