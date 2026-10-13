/**
 * Konfiguration der Formbewertung (Abschnitt 5). Alle Schwellen und Gewichte
 * stehen hier, nicht verstreut im Code.
 *
 * Annahmen, die nicht aus der Vorgabe stammen, sind mit ANNAHME markiert.
 */

/**
 * Perzentil-Grenzen der Stufen (gegen die eigene Karriere), wörtlich nach
 * Vorgabe: unter 25 schlecht, 25 bis unter 60 mittel, 60 bis 90 gut,
 * über 90 Bestform. `upTo` ist die Obergrenze, `inclusive` ob sie dazugehört.
 */
export const FORM_TIERS = [
  { key: "schlecht", label: "Schlechte Form", upTo: 25, inclusive: false },
  { key: "mittel", label: "Mittlere Form", upTo: 60, inclusive: false },
  { key: "gut", label: "Gute Form", upTo: 90, inclusive: true },
  { key: "bestform", label: "Bestform der Karriere", upTo: 100, inclusive: true },
] as const;

export type FormTierKey = (typeof FORM_TIERS)[number]["key"];

export const FORM_WINDOW = {
  /** Gleitender Durchschnitt über so viele Pflichtspiele … */
  matches: 5,
  /** … mit mindestens so vielen Minuten. */
  minMinutes: 30,
  /** Weniger qualifizierte Spiele = „zu wenig Daten“. */
  minMatches: 3,
  /**
   * ANNAHME: Nur Spiele der letzten 120 Tage zählen für die aktuelle Form,
   * damit ein Spieler nach langer Verletzung nicht mit uralten Spielen
   * bewertet wird.
   */
  maxAgeDays: 120,
};

/**
 * ANNAHME: Unter so vielen vollständigen 5-Spiele-Fenstern in der Karriere
 * wird darauf hingewiesen, dass „Bestform der Karriere“ wenig aussagt.
 */
export const SHORT_CAREER_WINDOWS = 20;

/** z-Werte werden auf ±3 begrenzt, damit ein Ausreißer nicht alles bestimmt. */
export const Z_CLIP = 3;

export type FormMetric =
  | "xg"
  | "xa"
  | "shotsOnTarget"
  | "keyPasses"
  | "dribblesSuccessful"
  | "scorerPoints"
  | "duelsWon"
  | "tackles"
  | "clearances"
  | "passAccuracy"
  | "errorsLeadingToGoal"
  | "goalsPrevented"
  | "savePct";

export const METRIC_LABEL: Record<FormMetric, string> = {
  xg: "xG pro 90",
  xa: "xA pro 90",
  shotsOnTarget: "Schüsse aufs Tor pro 90",
  keyPasses: "Schlüsselpässe pro 90",
  dribblesSuccessful: "Erfolgreiche Dribblings pro 90",
  scorerPoints: "Scorerpunkte pro 90",
  duelsWon: "Gewonnene Zweikämpfe pro 90",
  tackles: "Tacklings pro 90",
  clearances: "Klärungsaktionen pro 90",
  passAccuracy: "Passquote",
  errorsLeadingToGoal: "Fehler vor Gegentor",
  goalsPrevented: "Verhinderte Tore pro 90",
  savePct: "Quote gehaltener Schüsse",
};

/**
 * Gewichte je Positionsgruppe. Negative Gewichte für Kennzahlen, bei denen
 * mehr schlechter ist. Offensive und Innenverteidiger nach Vorgabe;
 * Mittelfeld und Torhüter: ANNAHME.
 * Passquote unter Druck liefert keine freie Quelle – wir nehmen die Passquote.
 */
export const FORM_WEIGHTS: Record<
  "forward" | "midfielder" | "defender" | "goalkeeper",
  Partial<Record<FormMetric, number>>
> = {
  forward: {
    xg: 0.25,
    xa: 0.15,
    shotsOnTarget: 0.15,
    keyPasses: 0.1,
    dribblesSuccessful: 0.1,
    scorerPoints: 0.25,
  },
  midfielder: {
    keyPasses: 0.2,
    xa: 0.15,
    xg: 0.1,
    scorerPoints: 0.15,
    passAccuracy: 0.15,
    duelsWon: 0.15,
    tackles: 0.1,
  },
  defender: {
    duelsWon: 0.25,
    clearances: 0.2,
    passAccuracy: 0.2,
    tackles: 0.1,
    errorsLeadingToGoal: -0.25,
  },
  goalkeeper: {
    goalsPrevented: 0.6,
    savePct: 0.25,
    passAccuracy: 0.15,
  },
};

/**
 * ANNAHME: Ligastärke relativ zur Bundesliga (1,0). Wird als Verschiebung in
 * Standardabweichungen addiert: (Stärke − 1) × LEAGUE_SHIFT_SD. So zählt ein
 * gleich guter z-Wert in einer schwächeren Liga etwas weniger.
 */
export const LEAGUE_STRENGTH: Record<string, number> = {
  PL: 1.05,
  BL1: 1.0,
  PD: 1.0,
  SA: 0.97,
  FL1: 0.92,
  CL: 1.1,
  EL: 0.95,
  TEST: 1.0,
};
export const LEAGUE_SHIFT_SD = 1;
