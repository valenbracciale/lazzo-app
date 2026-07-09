"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

export type TimeSlot = { time: string; available: boolean };

// Scroll/wheel-style picker: every slot in the day is always listed (never
// omitted), occupied ones stay visible but disabled with "Ocupado" so the
// user understands why a time is unavailable instead of wondering where it
// went. Times are always rendered in 24h format (e.g. "14:30").
export function TimeWheelPicker({
  slots,
  value,
  onChange,
  loading,
  disabled,
}: {
  slots: TimeSlot[];
  value: string | null;
  onChange: (time: string) => void;
  loading?: boolean;
  disabled?: boolean;
}) {
  const selectedRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    selectedRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [value]);

  if (loading) {
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        Buscando horarios...
      </p>
    );
  }

  if (slots.length === 0) {
    return <p className="text-sm text-muted-foreground">No hay horarios para esta fecha.</p>;
  }

  return (
    <div className="relative">
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-6 rounded-t-md bg-gradient-to-b from-background to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-6 rounded-b-md bg-gradient-to-t from-background to-transparent" />
      <div className="max-h-56 snap-y snap-mandatory overflow-y-auto rounded-md border border-border py-1">
        {slots.map((slot) => {
          const isSelected = value === slot.time;
          return (
            <button
              key={slot.time}
              ref={isSelected ? selectedRef : null}
              type="button"
              disabled={disabled || !slot.available}
              onClick={() => onChange(slot.time)}
              className={cn(
                "flex w-full snap-center items-center justify-between px-4 py-2.5 text-sm transition-colors",
                !slot.available && "cursor-not-allowed opacity-50",
                isSelected && slot.available
                  ? "bg-primary/10 font-medium text-primary"
                  : slot.available && "hover:bg-muted"
              )}
            >
              <span>{slot.time}</span>
              {!slot.available && (
                <span className="text-xs text-muted-foreground">Ocupado</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
