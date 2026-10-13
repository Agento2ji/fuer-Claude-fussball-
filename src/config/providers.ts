/**
 * Welche Anbieter je Datenart in welcher Reihenfolge gefragt werden.
 * Ein Anbieterwechsel ist eine Zeile hier. Nicht verfügbare Anbieter
 * (z. B. ohne API-Key) werden übersprungen.
 *
 * Testdaten stehen bewusst in keiner Kette: Sie werden nur über
 * `npm run ingest -- testdaten` eingespielt.
 */
export const PROVIDER_CHAINS = {
  matches: ["football-data", "openfootball"],
  odds: ["the-odds-api"],
  // Für die folgenden Datenarten gibt es ohne API-Key noch keinen Anbieter.
  players: [],
  injuries: [],
  suspensions: [],
  contracts: [],
  broadcasts: [],
} as const satisfies Record<string, readonly string[]>;

/** Cache-Dauer der Rohantworten in Sekunden (Abschnitt 3, Regel 4). */
export const CACHE_TTL_SECONDS = {
  masterData: 24 * 60 * 60,
  matches: 60 * 60,
  playerStats: 60 * 60,
  injuries: 2 * 60 * 60,
  odds: 10 * 60,
} as const;

/** Abruf-Limits je Anbieter (unterhalb der offiziellen Grenzen). */
export const RATE_LIMITS: Record<string, { requests: number; perMs: number }> =
  {
    "football-data": { requests: 9, perMs: 60_000 },
    "api-football": { requests: 1, perMs: 1_000 },
    "the-odds-api": { requests: 1, perMs: 1_000 },
    openfootball: { requests: 5, perMs: 1_000 },
  };
