// Buenos Aires es UTC-3 todo el año (sin horario de verano).
export const TZ_OFFSET = "-03:00";
const OFFSET_MS = 3 * 60 * 60 * 1000;

/** "2026-11-20" + "14:30" (hora BA) → Date UTC */
export function localToDate(date: string, hhmm: string): Date {
  return new Date(`${date}T${hhmm}:00${TZ_OFFSET}`);
}

/** Date → "HH:MM" en hora BA */
export function toLocalHHMM(d: Date): string {
  return new Date(d.getTime() - OFFSET_MS).toISOString().slice(11, 16);
}

/** Date → "YYYY-MM-DD" en hora BA */
export function toLocalDate(d: Date): string {
  return new Date(d.getTime() - OFFSET_MS).toISOString().slice(0, 10);
}

/** Día de la semana (0 = domingo) de una fecha local "YYYY-MM-DD" */
export function weekdayOf(date: string): number {
  return new Date(`${date}T12:00:00${TZ_OFFSET}`).getUTCDay();
}

export function hhmmToMin(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

export function minToHHMM(min: number): string {
  return `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
}
