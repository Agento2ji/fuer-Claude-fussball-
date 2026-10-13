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
  /** Zeitzone, in der Quellen ohne UTC-Angabe die Anstoßzeit liefern. */
  timezone: string;
  /** IDs bzw. Schlüssel dieses Wettbewerbs bei den einzelnen Anbietern. */
  providerIds: {
    openfootball?: string;
    footballData?: string;
    theOddsApi?: string;
    apiFootball?: number;
  };
}

/** Laufende Saison. Wird zum Saisonwechsel hier umgestellt. */
export const CURRENT_SEASON = { label: "2026/27", startYear: 2026 } as const;

export const COMPETITIONS = [
  {
    code: "BL1",
    name: "Bundesliga",
    country: "DE",
    type: "league",
    hasMatchPages: true,
    yellowCardSuspensionThreshold: 5,
    timezone: "Europe/Berlin",
    providerIds: {
      openfootball: "de.1",
      footballData: "BL1",
      theOddsApi: "soccer_germany_bundesliga",
      apiFootball: 78,
    },
  },
  {
    code: "PL",
    name: "Premier League",
    country: "GB-ENG",
    type: "league",
    hasMatchPages: true,
    yellowCardSuspensionThreshold: null,
    timezone: "Europe/London",
    providerIds: {
      openfootball: "en.1",
      footballData: "PL",
      theOddsApi: "soccer_epl",
      apiFootball: 39,
    },
  },
  {
    code: "SA",
    name: "Serie A",
    country: "IT",
    type: "league",
    hasMatchPages: true,
    yellowCardSuspensionThreshold: null,
    timezone: "Europe/Rome",
    providerIds: {
      openfootball: "it.1",
      footballData: "SA",
      theOddsApi: "soccer_italy_serie_a",
      apiFootball: 135,
    },
  },
  {
    code: "PD",
    name: "LaLiga",
    country: "ES",
    type: "league",
    hasMatchPages: true,
    yellowCardSuspensionThreshold: null,
    timezone: "Europe/Madrid",
    providerIds: {
      openfootball: "es.1",
      footballData: "PD",
      theOddsApi: "soccer_spain_la_liga",
      apiFootball: 140,
    },
  },
  {
    code: "FL1",
    name: "Ligue 1",
    country: "FR",
    type: "league",
    hasMatchPages: true,
    yellowCardSuspensionThreshold: null,
    timezone: "Europe/Paris",
    providerIds: {
      openfootball: "fr.1",
      footballData: "FL1",
      theOddsApi: "soccer_france_ligue_one",
      apiFootball: 61,
    },
  },
  {
    code: "CL",
    name: "Champions League",
    country: "EU",
    type: "cup",
    hasMatchPages: true,
    yellowCardSuspensionThreshold: null,
    timezone: "Europe/Berlin",
    providerIds: {
      footballData: "CL",
      theOddsApi: "soccer_uefa_champs_league",
      apiFootball: 2,
    },
  },
  {
    code: "EL",
    name: "Europa League",
    country: "EU",
    type: "cup",
    hasMatchPages: true,
    yellowCardSuspensionThreshold: null,
    timezone: "Europe/Berlin",
    providerIds: {
      footballData: "EL",
      theOddsApi: "soccer_uefa_europa_league",
      apiFootball: 3,
    },
  },
] as const satisfies readonly CompetitionConfig[];

export type CompetitionCode = (typeof COMPETITIONS)[number]["code"];

export function getCompetition(code: string): CompetitionConfig | undefined {
  return COMPETITIONS.find((c) => c.code === code);
}
