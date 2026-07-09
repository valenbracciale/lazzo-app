// All helpers here assume they run in the browser (client components only).
// Reservation timestamps are stored as UTC (timestamptz), but businesses are
// in Argentina and every date the owner sees or types must be in *their*
// local time - never computed on the server, whose runtime clock/timezone
// can differ from the browser's.

export function toLocalDateInputValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function toLocalDatetimeInputValue(iso: string): string {
  const date = new Date(iso);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

export function localDayRangeToUtc(localDate: string): { start: string; end: string } {
  const [year, month, day] = localDate.split("-").map(Number);
  const start = new Date(year, month - 1, day, 0, 0, 0, 0);
  const end = new Date(year, month - 1, day + 1, 0, 0, 0, 0);
  return { start: start.toISOString(), end: end.toISOString() };
}

export function shiftLocalDate(localDate: string, deltaDays: number): string {
  const [year, month, day] = localDate.split("-").map(Number);
  const shifted = new Date(year, month - 1, day + deltaDays);
  return toLocalDateInputValue(shifted);
}

export function formatLocalTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export function formatLocalDateLabel(localDate: string): string {
  const [year, month, day] = localDate.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString("es-AR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}
