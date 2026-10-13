/**
 * Normalisierte Datensätze und Provider-Schnittstellen.
 *
 * Jeder Adapter übersetzt das Format seines Anbieters in diese Typen. Alles
 * dahinter (Jobs, Datenbank, UI) kennt nur diese Typen, nie das Rohformat.
 * IDs (`externalId`) gelten nur innerhalb des jeweiligen Anbieters; die
 * Zuordnung zu internen IDs passiert über die Tabelle `external_ids`.
 */

export interface Provenance {
  /** Schlüssel aus `src/config/data-sources.ts`. */
  source: string;
  fetchedAt: Date;
  sourceUrl: string | null;
}

export type Sourced<T> = T & { provenance: Provenance };

export type MatchStatus =
  | "scheduled"
  | "live"
  | "finished"
  | "postponed"
  | "cancelled";

export type Position = "goalkeeper" | "defender" | "midfielder" | "forward";

export interface TeamRecord {
  externalId: string;
  name: string;
  shortName?: string | null;
  country?: string | null;
  crestUrl?: string | null;
}

export interface MatchRecord {
  externalId: string;
  competitionCode: string;
  /** z. B. "2026/27" */
  season: string;
  matchday: number | null;
  stage: string | null;
  homeTeam: TeamRecord;
  awayTeam: TeamRecord;
  kickoffAt: Date;
  /** false = nur das Datum ist bekannt. */
  kickoffTimeKnown: boolean;
  status: MatchStatus;
  homeScore: number | null;
  awayScore: number | null;
}

export interface PlayerRecord {
  externalId: string;
  teamExternalId: string;
  name: string;
  firstName: string | null;
  lastName: string | null;
  /** ISO-Datum YYYY-MM-DD */
  birthDate: string | null;
  nationality: string | null;
  position: Position | null;
  detailedPosition: string | null;
  shirtNumber: number | null;
}

export interface PlayerMatchStatsRecord {
  playerExternalId: string;
  matchExternalId: string;
  teamExternalId: string;
  minutes: number;
  goals: number | null;
  assists: number | null;
  shots: number | null;
  shotsOnTarget: number | null;
  xg: number | null;
  xa: number | null;
  passes: number | null;
  passesCompleted: number | null;
  keyPasses: number | null;
  duels: number | null;
  duelsWon: number | null;
  dribblesAttempted: number | null;
  dribblesSuccessful: number | null;
  dispossessed: number | null;
  tackles: number | null;
  clearances: number | null;
  errorsLeadingToGoal: number | null;
  foulsCommitted: number | null;
  yellowCards: number | null;
  redCards: number | null;
  rating: number | null;
  saves: number | null;
  goalsConceded: number | null;
  psxgFaced: number | null;
  cleanSheet: boolean | null;
}

export interface TeamMatchStatsRecord {
  matchExternalId: string;
  teamExternalId: string;
  goals: number | null;
  goalsConceded: number | null;
  xg: number | null;
  xga: number | null;
  possessionPct: number | null;
  passes: number | null;
  passAccuracyPct: number | null;
  shots: number | null;
  shotsOnTarget: number | null;
  corners: number | null;
  setPieceGoals: number | null;
  ppda: number | null;
  /** Tore nach Spielabschnitten, Schlüssel z. B. "0-15", "16-30" … "76-90". */
  goalsByPeriod: Record<string, number> | null;
}

export interface InjuryRecord {
  playerExternalId: string;
  status: "injured" | "doubtful";
  injuryType: string | null;
  description: string | null;
  since: string | null;
  expectedReturn: string | null;
}

export interface SuspensionRecord {
  playerExternalId: string;
  reason: "yellow_accumulation" | "yellow_red" | "red" | "other";
  /** null = wettbewerbsübergreifend */
  competitionCode: string | null;
  matchesCount: number;
  triggeredByMatchExternalId: string | null;
}

export interface ContractRecord {
  playerExternalId: string;
  teamExternalId: string;
  startDate: string | null;
  endDate: string | null;
  isLoan: boolean;
  marketValueEur: number | null;
  marketValueDate: string | null;
}

export interface BroadcastRecord {
  matchExternalId: string;
  country: string;
  broadcaster: string;
  isPaid: boolean;
  url: string | null;
}

export interface OddsRecord {
  /** Anbieterseitige Spiel-ID plus Merkmale zum Zuordnen. */
  match: {
    externalId: string;
    homeTeamName: string;
    awayTeamName: string;
    kickoffAt: Date;
  };
  /** Schlüssel aus `src/config/bookmakers.ts` */
  bookmakerKey: string;
  market: "h2h" | "double_chance" | "totals" | "btts" | "handicap" | "goalscorer";
  selection: string;
  line: number | null;
  price: number;
  bookmakerUpdatedAt: Date | null;
}

// ---------------------------------------------------------------------------
// Provider-Schnittstellen
// ---------------------------------------------------------------------------

export interface ProviderBase {
  /** Schlüssel aus `src/config/data-sources.ts` */
  readonly key: string;
  /** false, wenn z. B. der API-Key fehlt. Der Provider wird dann übersprungen. */
  isAvailable(): boolean;
}

export interface MatchProvider extends ProviderBase {
  supports(competitionCode: string): boolean;
  getMatches(competitionCode: string): Promise<Sourced<MatchRecord>[]>;
}

export interface PlayerProvider extends ProviderBase {
  getSquad(teamExternalId: string): Promise<Sourced<PlayerRecord>[]>;
  getPlayerMatchStats(
    competitionCode: string,
  ): Promise<Sourced<PlayerMatchStatsRecord>[]>;
}

export interface InjuryProvider extends ProviderBase {
  getInjuries(competitionCode: string): Promise<Sourced<InjuryRecord>[]>;
}

export interface SuspensionProvider extends ProviderBase {
  getSuspensions(competitionCode: string): Promise<Sourced<SuspensionRecord>[]>;
}

export interface ContractProvider extends ProviderBase {
  getContracts(teamExternalId: string): Promise<Sourced<ContractRecord>[]>;
}

export interface OddsProvider extends ProviderBase {
  supports(competitionCode: string): boolean;
  getOdds(competitionCode: string): Promise<Sourced<OddsRecord>[]>;
}

export interface BroadcastProvider extends ProviderBase {
  getBroadcasts(competitionCode: string): Promise<Sourced<BroadcastRecord>[]>;
}

/** Fehler, nach dem die Fallback-Kette den nächsten Anbieter versuchen soll. */
export class ProviderError extends Error {
  constructor(
    readonly provider: string,
    message: string,
    readonly cause?: unknown,
  ) {
    super(`[${provider}] ${message}`);
    this.name = "ProviderError";
  }
}
