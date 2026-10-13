/**
 * Wettbewerbe als reine Konfiguration. Ein neuer Wettbewerb ist ein neuer
 * Eintrag hier – Code muss dafür nicht angefasst werden.
 *
 * `hasMatchPages`: bekommt eigene Spiel- und Quotenseiten. Wettbewerbe ohne
 * eigene Seiten (Pokale, Länderspiele) zählen trotzdem für Statistik,
 * Sperrenstand und Formbewertung, sobald ihre Daten eingelesen werden.
 */
export type CompetitionType = "league" | "cup" | "international";

export interface CompetitionConfig {
  /** Interner, stabiler Schlüssel. */
  code: string;
  name: string;
  /** ISO-3166-Alpha-2 bzw. "EU" für UEFA-Wettbewerbe. */
  country: string;
  type: CompetitionType;
  hasMatchPages: boolean;
  /**
   * Gelbe Karten bis zur Sperre. `null` = Regel noch nicht hinterlegt;
   * die UI zeigt dann keinen Sperrabstand an, statt einen zu raten.
   */
  yellowCardSuspensionThreshold: number | null;
}

export const COMPETITIONS = [
  {
    code: "BL1",
    name: "Bundesliga",
    country: "DE",
    type: "league",
    hasMatchPages: true,
    yellowCardSuspensionThreshold: 5,
  },
  {
    code: "PL",
    name: "Premier League",
    country: "GB-ENG",
    type: "league",
    hasMatchPages: true,
    yellowCardSuspensionThreshold: null,
  },
  {
    code: "SA",
    name: "Serie A",
    country: "IT",
    type: "league",
    hasMatchPages: true,
    yellowCardSuspensionThreshold: null,
  },
  {
    code: "PD",
    name: "LaLiga",
    country: "ES",
    type: "league",
    hasMatchPages: true,
    yellowCardSuspensionThreshold: null,
  },
  {
    code: "FL1",
    name: "Ligue 1",
    country: "FR",
    type: "league",
    hasMatchPages: true,
    yellowCardSuspensionThreshold: null,
  },
  {
    code: "CL",
    name: "Champions League",
    country: "EU",
    type: "cup",
    hasMatchPages: true,
    yellowCardSuspensionThreshold: null,
  },
  {
    code: "EL",
    name: "Europa League",
    country: "EU",
    type: "cup",
    hasMatchPages: true,
    yellowCardSuspensionThreshold: null,
  },
] as const satisfies readonly CompetitionConfig[];

export type CompetitionCode = (typeof COMPETITIONS)[number]["code"];

export function getCompetition(code: string): CompetitionConfig | undefined {
  return COMPETITIONS.find((c) => c.code === code);
}
