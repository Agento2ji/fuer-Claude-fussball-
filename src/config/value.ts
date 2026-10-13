/**
 * Konfiguration der Value-Analyse (Abschnitt 6). Annahmen sind mit ANNAHME
 * markiert.
 */

/** Mindest-Erwartungswert, darunter wird nichts als Value gezeigt (Vorgabe: 2 %). */
export const MIN_EV = 0.02;

/** Angezeigter Kelly-Anteil: ein Viertel, nie der volle (Vorgabe). */
export const KELLY_FRACTION = 0.25;

/** Quoten älter als so viele Minuten gelten als veraltet (Vorgabe). */
export const STALE_MINUTES = 15;

/** Hauptmethode zum Entfernen der Buchmachermarge; die anderen werden zum Vergleich gezeigt. */
export const PRIMARY_DEVIG = "power" as const;

/**
 * ANNAHME: Konsens-Gewicht je Anbieter = 1 / Marge (niedrige Marge = schärferer
 * Markt = mehr Gewicht). Untergrenze, damit ein Anbieter mit fast 0 % Marge
 * nicht allein bestimmt.
 */
export const MARGIN_FLOOR = 0.01;

/**
 * ANNAHME: Risikostufe nach Standardabweichung der Auszahlung je 1 € Einsatz
 * (σ = q · √(p · (1 − p))).
 */
export const RISK_LEVELS = [
  { key: "low", label: "niedrig", maxStdDev: 1.0 },
  { key: "medium", label: "mittel", maxStdDev: 2.0 },
  { key: "high", label: "hoch", maxStdDev: Infinity },
] as const;

/** Wie viele Value-Wetten je Spiel hervorgehoben werden (Vorgabe: drei). */
export const TOP_N = 3;
