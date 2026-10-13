import { formatBerlin } from "@/lib/time";

/** Zahlen- und Datumsformate für die Anzeige (deutsch, Europe/Berlin). */
export const de1 = new Intl.NumberFormat("de-DE", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
export const de2 = new Intl.NumberFormat("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const pct = new Intl.NumberFormat("de-DE", { style: "percent", maximumFractionDigits: 0 });
export const eur = new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", notation: "compact", maximumFractionDigits: 1 });

export const dateShort = (d: Date) => formatBerlin(d, { day: "2-digit", month: "2-digit" });

/** Datum lang; ISO-Datumsstrings (YYYY-MM-DD) werden mittags UTC gelesen, damit der Tag stimmt. */
export const dateLong = (d: Date | string) =>
  formatBerlin(typeof d === "string" ? new Date(`${d}T12:00:00Z`) : d, { dateStyle: "medium" });

/** Anstoß mit Wochentag; bei unbekannter Uhrzeit nur das Datum. */
export const kickoffText = (d: Date, timeKnown: boolean) =>
  timeKnown
    ? formatBerlin(d, { weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })
    : `${formatBerlin(d, { weekday: "short", day: "2-digit", month: "2-digit" })}, Uhrzeit offen`;

/** Vorzeichen für Differenzen, z. B. +3 / −2. */
export const signed = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : "0");
