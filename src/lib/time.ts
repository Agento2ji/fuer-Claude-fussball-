/**
 * Wandelt eine lokale Wanduhrzeit in einer IANA-Zeitzone in UTC um,
 * inklusive Sommerzeit. Ohne Zusatzbibliothek, über Intl.
 */
export function zonedTimeToUtc(
  date: string,
  time: string,
  timeZone: string,
): Date {
  const [y, mo, d] = date.split("-").map(Number);
  const [h, mi] = time.split(":").map(Number);
  if ([y, mo, d, h, mi].some((n) => n === undefined || Number.isNaN(n))) {
    throw new Error(`Ungültiges Datum/Uhrzeit: ${date} ${time}`);
  }
  const asUtc = Date.UTC(y!, mo! - 1, d!, h!, mi!);
  // Offset der Zone zu diesem Zeitpunkt bestimmen und zweimal anwenden,
  // damit auch Zeitpunkte nahe der Umstellung stimmen.
  let guess = asUtc - offsetMs(new Date(asUtc), timeZone);
  guess = asUtc - offsetMs(new Date(guess), timeZone);
  return new Date(guess);
}

function offsetMs(at: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(at);
  const get = (type: string) =>
    Number(parts.find((p) => p.type === type)?.value);
  const local = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour"),
    get("minute"),
    get("second"),
  );
  return local - Math.floor(at.getTime() / 1000) * 1000;
}

/** Formatiert einen Zeitpunkt für die Anzeige in Europe/Berlin. */
export function formatBerlin(
  at: Date,
  options: Intl.DateTimeFormatOptions = {
    dateStyle: "medium",
    timeStyle: "short",
  },
): string {
  return new Intl.DateTimeFormat("de-DE", {
    timeZone: "Europe/Berlin",
    ...options,
  }).format(at);
}
