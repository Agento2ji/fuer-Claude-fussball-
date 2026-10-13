/**
 * Datenmodell (Abschnitt 9). Grundregeln:
 * - Alle Zeiten als `timestamptz` in UTC; angezeigt wird in Europe/Berlin.
 * - Jede fachliche Zeile trägt ihre Herkunft: `source_id`, `fetched_at`,
 *   `source_url`.
 * - Externe IDs liegen in `external_ids`, nie in den Fachtabellen.
 * - `odds_snapshots` ist append-only (per Trigger erzwungen, siehe Migration).
 */
import { sql } from "drizzle-orm";
import {
  bigserial,
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  serial,
  smallint,
  text,
  timestamp,
  unique,
  uniqueIndex,
} from "drizzle-orm/pg-core";

const tstz = (name: string) =>
  timestamp(name, { withTimezone: true, mode: "date" });

/** Herkunftsspalten für jede Zeile, die Daten von außen enthält. */
const provenance = () => ({
  sourceId: integer("source_id")
    .notNull()
    .references(() => dataSources.id),
  fetchedAt: tstz("fetched_at").notNull(),
  sourceUrl: text("source_url"),
});

const timestamps = () => ({
  createdAt: tstz("created_at").notNull().defaultNow(),
  updatedAt: tstz("updated_at")
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export const competitionType = pgEnum("competition_type", [
  "league",
  "cup",
  "international",
]);

export const entityType = pgEnum("entity_type", [
  "competition",
  "team",
  "player",
  "match",
  "bookmaker",
]);

export const position = pgEnum("position", [
  "goalkeeper",
  "defender",
  "midfielder",
  "forward",
]);

export const matchStatus = pgEnum("match_status", [
  "scheduled",
  "live",
  "finished",
  "postponed",
  "cancelled",
]);

export const injuryStatus = pgEnum("injury_status", ["injured", "doubtful"]);

export const suspensionReason = pgEnum("suspension_reason", [
  "yellow_accumulation",
  "yellow_red",
  "red",
  "other",
]);

export const cardType = pgEnum("card_type", ["yellow", "yellow_red", "red"]);

export const riskLevel = pgEnum("risk_level", ["low", "medium", "high"]);

export const devigMethod = pgEnum("devig_method", [
  "proportional",
  "shin",
  "power",
]);

// ---------------------------------------------------------------------------
// Quellen und ID-Mapping
// ---------------------------------------------------------------------------

export const dataSources = pgTable("data_sources", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(),
  name: text("name").notNull(),
  kind: text("kind").notNull(),
  baseUrl: text("base_url").notNull(),
  /** Kleinere Zahl = höhere Priorität bei Konflikten. */
  priority: smallint("priority").notNull(),
  status: text("status").notNull(),
  licenseNote: text("license_note").notNull(),
  ...timestamps(),
});

export const externalIds = pgTable(
  "external_ids",
  {
    id: serial("id").primaryKey(),
    entityType: entityType("entity_type").notNull(),
    entityId: integer("entity_id").notNull(),
    sourceId: integer("source_id")
      .notNull()
      .references(() => dataSources.id),
    externalId: text("external_id").notNull(),
    createdAt: tstz("created_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("external_ids_source_entity_ext_uq").on(
      t.sourceId,
      t.entityType,
      t.externalId,
    ),
    index("external_ids_entity_idx").on(t.entityType, t.entityId),
  ],
);

// ---------------------------------------------------------------------------
// Stammdaten
// ---------------------------------------------------------------------------

export const competitions = pgTable("competitions", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  country: text("country").notNull(),
  type: competitionType("type").notNull(),
  hasMatchPages: boolean("has_match_pages").notNull().default(false),
  yellowCardSuspensionThreshold: smallint("yellow_card_suspension_threshold"),
  /** Testdaten-Wettbewerb: nie mit echten Daten mischen, in der UI kennzeichnen. */
  isTestData: boolean("is_test_data").notNull().default(false),
  ...timestamps(),
});

export const teams = pgTable("teams", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  shortName: text("short_name"),
  country: text("country"),
  /** Nur befüllen, wenn die Rechtelage Logos/Wappen erlaubt. */
  crestUrl: text("crest_url"),
  venue: text("venue"),
  ...provenance(),
  ...timestamps(),
});

export const players = pgTable(
  "players",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    firstName: text("first_name"),
    lastName: text("last_name"),
    /** Teil des Matching-Schlüssels (Name + Geburtsdatum + Verein). */
    birthDate: date("birth_date", { mode: "string" }),
    nationality: text("nationality"),
    position: position("position"),
    detailedPosition: text("detailed_position"),
    currentTeamId: integer("current_team_id").references(() => teams.id),
    shirtNumber: smallint("shirt_number"),
    ...provenance(),
    ...timestamps(),
  },
  (t) => [
    index("players_name_birth_idx").on(t.lastName, t.birthDate),
    index("players_team_idx").on(t.currentTeamId),
  ],
);

export const contracts = pgTable(
  "contracts",
  {
    id: serial("id").primaryKey(),
    playerId: integer("player_id")
      .notNull()
      .references(() => players.id),
    teamId: integer("team_id")
      .notNull()
      .references(() => teams.id),
    startDate: date("start_date", { mode: "string" }),
    endDate: date("end_date", { mode: "string" }),
    isLoan: boolean("is_loan").notNull().default(false),
    marketValueEur: integer("market_value_eur"),
    marketValueDate: date("market_value_date", { mode: "string" }),
    ...provenance(),
    ...timestamps(),
  },
  (t) => [
    index("contracts_player_idx").on(t.playerId),
    uniqueIndex("contracts_player_team_source_uq").on(
      t.playerId,
      t.teamId,
      t.sourceId,
    ),
  ],
);

// ---------------------------------------------------------------------------
// Spiele
// ---------------------------------------------------------------------------

export const matches = pgTable(
  "matches",
  {
    id: serial("id").primaryKey(),
    competitionId: integer("competition_id")
      .notNull()
      .references(() => competitions.id),
    /** z. B. "2026/27" */
    season: text("season").notNull(),
    matchday: smallint("matchday"),
    stage: text("stage"),
    homeTeamId: integer("home_team_id")
      .notNull()
      .references(() => teams.id),
    awayTeamId: integer("away_team_id")
      .notNull()
      .references(() => teams.id),
    kickoffAt: tstz("kickoff_at").notNull(),
    /** false = nur das Datum ist bekannt, die Uhrzeit ist ein Platzhalter. */
    kickoffTimeKnown: boolean("kickoff_time_known").notNull().default(true),
    status: matchStatus("status").notNull().default("scheduled"),
    homeScore: smallint("home_score"),
    awayScore: smallint("away_score"),
    venue: text("venue"),
    ...provenance(),
    ...timestamps(),
  },
  (t) => [
    index("matches_kickoff_idx").on(t.kickoffAt),
    index("matches_competition_season_idx").on(t.competitionId, t.season),
    index("matches_home_idx").on(t.homeTeamId, t.kickoffAt),
    index("matches_away_idx").on(t.awayTeamId, t.kickoffAt),
    check("matches_distinct_teams", sql`${t.homeTeamId} <> ${t.awayTeamId}`),
  ],
);

export const lineups = pgTable(
  "lineups",
  {
    id: serial("id").primaryKey(),
    matchId: integer("match_id")
      .notNull()
      .references(() => matches.id),
    teamId: integer("team_id")
      .notNull()
      .references(() => teams.id),
    playerId: integer("player_id")
      .notNull()
      .references(() => players.id),
    /** true = voraussichtliche Aufstellung, false = offiziell bestätigt. */
    isProbable: boolean("is_probable").notNull(),
    isStarter: boolean("is_starter").notNull(),
    positionLabel: text("position_label"),
    shirtNumber: smallint("shirt_number"),
    formation: text("formation"),
    ...provenance(),
  },
  (t) => [
    uniqueIndex("lineups_match_player_kind_uq").on(
      t.matchId,
      t.playerId,
      t.isProbable,
    ),
  ],
);

export const playerMatchStats = pgTable(
  "player_match_stats",
  {
    id: serial("id").primaryKey(),
    matchId: integer("match_id")
      .notNull()
      .references(() => matches.id),
    playerId: integer("player_id")
      .notNull()
      .references(() => players.id),
    teamId: integer("team_id")
      .notNull()
      .references(() => teams.id),
    minutes: smallint("minutes").notNull(),
    goals: smallint("goals"),
    assists: smallint("assists"),
    shots: smallint("shots"),
    shotsOnTarget: smallint("shots_on_target"),
    xg: numeric("xg", { precision: 6, scale: 3, mode: "number" }),
    xa: numeric("xa", { precision: 6, scale: 3, mode: "number" }),
    passes: smallint("passes"),
    passesCompleted: smallint("passes_completed"),
    keyPasses: smallint("key_passes"),
    duels: smallint("duels"),
    duelsWon: smallint("duels_won"),
    dribblesAttempted: smallint("dribbles_attempted"),
    dribblesSuccessful: smallint("dribbles_successful"),
    dispossessed: smallint("dispossessed"),
    tackles: smallint("tackles"),
    clearances: smallint("clearances"),
    errorsLeadingToGoal: smallint("errors_leading_to_goal"),
    foulsCommitted: smallint("fouls_committed"),
    yellowCards: smallint("yellow_cards"),
    redCards: smallint("red_cards"),
    rating: numeric("rating", { precision: 4, scale: 2, mode: "number" }),
    // Torhüter
    saves: smallint("saves"),
    goalsConceded: smallint("goals_conceded"),
    /** Post-Shot-xG der zugelassenen Schüsse, für „verhinderte Tore“. */
    psxgFaced: numeric("psxg_faced", { precision: 6, scale: 3, mode: "number" }),
    cleanSheet: boolean("clean_sheet"),
    ...provenance(),
  },
  (t) => [
    uniqueIndex("player_match_stats_match_player_uq").on(t.matchId, t.playerId),
    index("player_match_stats_player_idx").on(t.playerId),
  ],
);

export const teamMatchStats = pgTable(
  "team_match_stats",
  {
    id: serial("id").primaryKey(),
    matchId: integer("match_id")
      .notNull()
      .references(() => matches.id),
    teamId: integer("team_id")
      .notNull()
      .references(() => teams.id),
    goals: smallint("goals"),
    goalsConceded: smallint("goals_conceded"),
    xg: numeric("xg", { precision: 6, scale: 3, mode: "number" }),
    xga: numeric("xga", { precision: 6, scale: 3, mode: "number" }),
    possessionPct: numeric("possession_pct", {
      precision: 5,
      scale: 2,
      mode: "number",
    }),
    passes: smallint("passes"),
    passAccuracyPct: numeric("pass_accuracy_pct", {
      precision: 5,
      scale: 2,
      mode: "number",
    }),
    shots: smallint("shots"),
    shotsOnTarget: smallint("shots_on_target"),
    corners: smallint("corners"),
    setPieceGoals: smallint("set_piece_goals"),
    ppda: numeric("ppda", { precision: 6, scale: 2, mode: "number" }),
    /** Tore nach Spielabschnitten, z. B. {"0-15": 1, "16-30": 0, …} */
    goalsByPeriod: jsonb("goals_by_period").$type<Record<string, number>>(),
    ...provenance(),
  },
  (t) => [
    uniqueIndex("team_match_stats_match_team_uq").on(t.matchId, t.teamId),
  ],
);

// ---------------------------------------------------------------------------
// Verfügbarkeit
// ---------------------------------------------------------------------------

export const injuries = pgTable(
  "injuries",
  {
    id: serial("id").primaryKey(),
    playerId: integer("player_id")
      .notNull()
      .references(() => players.id),
    status: injuryStatus("status").notNull(),
    injuryType: text("injury_type"),
    description: text("description"),
    since: date("since", { mode: "string" }),
    expectedReturn: date("expected_return", { mode: "string" }),
    /** Gesetzt, sobald der Spieler wieder einsatzbereit ist. */
    endedAt: date("ended_at", { mode: "string" }),
    ...provenance(),
    ...timestamps(),
  },
  (t) => [
    index("injuries_player_idx").on(t.playerId),
    unique("injuries_player_source_since_uq")
      .on(t.playerId, t.sourceId, t.since)
      .nullsNotDistinct(),
  ],
);

export const suspensions = pgTable(
  "suspensions",
  {
    id: serial("id").primaryKey(),
    playerId: integer("player_id")
      .notNull()
      .references(() => players.id),
    reason: suspensionReason("reason").notNull(),
    /** null = gilt wettbewerbsübergreifend. */
    competitionId: integer("competition_id").references(() => competitions.id),
    matchesCount: smallint("matches_count").notNull(),
    triggeredByMatchId: integer("triggered_by_match_id").references(
      () => matches.id,
    ),
    firstEligibleMatchId: integer("first_eligible_match_id").references(
      () => matches.id,
    ),
    active: boolean("active").notNull().default(true),
    ...provenance(),
    ...timestamps(),
  },
  (t) => [
    index("suspensions_player_idx").on(t.playerId),
    unique("suspensions_player_source_trigger_uq")
      .on(t.playerId, t.sourceId, t.reason, t.triggeredByMatchId)
      .nullsNotDistinct(),
  ],
);

export const cards = pgTable(
  "cards",
  {
    id: serial("id").primaryKey(),
    playerId: integer("player_id")
      .notNull()
      .references(() => players.id),
    matchId: integer("match_id")
      .notNull()
      .references(() => matches.id),
    competitionId: integer("competition_id")
      .notNull()
      .references(() => competitions.id),
    type: cardType("type").notNull(),
    minute: smallint("minute"),
    ...provenance(),
  },
  (t) => [
    index("cards_player_competition_idx").on(t.playerId, t.competitionId),
    unique("cards_match_player_type_minute_uq")
      .on(t.matchId, t.playerId, t.type, t.minute)
      .nullsNotDistinct(),
  ],
);

// ---------------------------------------------------------------------------
// News und Übertragung
// ---------------------------------------------------------------------------

export const news = pgTable(
  "news",
  {
    id: serial("id").primaryKey(),
    title: text("title").notNull(),
    url: text("url").notNull().unique(),
    summary: text("summary"),
    publishedAt: tstz("published_at").notNull(),
    playerId: integer("player_id").references(() => players.id),
    teamId: integer("team_id").references(() => teams.id),
    ...provenance(),
  },
  (t) => [
    index("news_player_idx").on(t.playerId, t.publishedAt),
    index("news_team_idx").on(t.teamId, t.publishedAt),
  ],
);

export const broadcasts = pgTable(
  "broadcasts",
  {
    id: serial("id").primaryKey(),
    matchId: integer("match_id")
      .notNull()
      .references(() => matches.id),
    country: text("country").notNull().default("DE"),
    broadcaster: text("broadcaster").notNull(),
    isPaid: boolean("is_paid").notNull(),
    url: text("url"),
    ...provenance(),
  },
  (t) => [
    uniqueIndex("broadcasts_match_country_broadcaster_uq").on(
      t.matchId,
      t.country,
      t.broadcaster,
    ),
  ],
);

// ---------------------------------------------------------------------------
// Quoten
// ---------------------------------------------------------------------------

export const bookmakers = pgTable("bookmakers", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(),
  name: text("name").notNull(),
  showInComparison: boolean("show_in_comparison").notNull(),
  useForFairPrice: boolean("use_for_fair_price").notNull(),
  gglLicenseVerified: boolean("ggl_license_verified").notNull().default(false),
  gglLicenseNumber: text("ggl_license_number"),
  ...timestamps(),
});

/** Append-only: UPDATE und DELETE verhindert ein Trigger. */
export const oddsSnapshots = pgTable(
  "odds_snapshots",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    matchId: integer("match_id")
      .notNull()
      .references(() => matches.id),
    bookmakerId: integer("bookmaker_id")
      .notNull()
      .references(() => bookmakers.id),
    /** z. B. h2h, double_chance, totals, btts, handicap, goalscorer */
    market: text("market").notNull(),
    /** z. B. home, draw, away, over, under, yes, no, oder Spieler-ID */
    selection: text("selection").notNull(),
    /** Linie bei Über/Unter und Handicap, sonst null. */
    line: numeric("line", { precision: 5, scale: 2, mode: "number" }),
    price: numeric("price", { precision: 8, scale: 3, mode: "number" }).notNull(),
    /** Zeitpunkt, zu dem der Anbieter die Quote gemeldet hat. */
    bookmakerUpdatedAt: tstz("bookmaker_updated_at"),
    ...provenance(),
  },
  (t) => [
    index("odds_snapshots_match_market_idx").on(
      t.matchId,
      t.market,
      t.fetchedAt,
    ),
    check("odds_snapshots_price_gt_1", sql`${t.price} > 1`),
  ],
);

export const valueBets = pgTable(
  "value_bets",
  {
    id: serial("id").primaryKey(),
    matchId: integer("match_id")
      .notNull()
      .references(() => matches.id),
    market: text("market").notNull(),
    selection: text("selection").notNull(),
    line: numeric("line", { precision: 5, scale: 2, mode: "number" }),
    bestBookmakerId: integer("best_bookmaker_id")
      .notNull()
      .references(() => bookmakers.id),
    bestPrice: numeric("best_price", {
      precision: 8,
      scale: 3,
      mode: "number",
    }).notNull(),
    fairProbability: numeric("fair_probability", {
      precision: 7,
      scale: 6,
      mode: "number",
    }).notNull(),
    fairPrice: numeric("fair_price", {
      precision: 8,
      scale: 3,
      mode: "number",
    }).notNull(),
    devigMethod: devigMethod("devig_method").notNull(),
    /** Erwartungswert als Anteil, 0.035 = +3,5 %. */
    ev: numeric("ev", { precision: 7, scale: 5, mode: "number" }).notNull(),
    /** Viertel-Kelly als Anteil der Bankroll. */
    kellyQuarter: numeric("kelly_quarter", {
      precision: 7,
      scale: 5,
      mode: "number",
    }).notNull(),
    riskLevel: riskLevel("risk_level").notNull(),
    /** Zeitstempel der jüngsten verwendeten Quote (Veraltet-Kennzeichnung). */
    oddsFetchedAt: tstz("odds_fetched_at").notNull(),
    computedAt: tstz("computed_at").notNull().defaultNow(),
  },
  (t) => [index("value_bets_match_idx").on(t.matchId, t.computedAt)],
);

// ---------------------------------------------------------------------------
// Betrieb: Job-Protokoll und Quellenkonflikte
// ---------------------------------------------------------------------------

export const jobStatus = pgEnum("job_status", [
  "running",
  "succeeded",
  "failed",
  "skipped",
]);

export const jobRuns = pgTable(
  "job_runs",
  {
    id: serial("id").primaryKey(),
    job: text("job").notNull(),
    status: jobStatus("status").notNull(),
    startedAt: tstz("started_at").notNull().defaultNow(),
    finishedAt: tstz("finished_at"),
    durationMs: integer("duration_ms"),
    itemsWritten: integer("items_written"),
    error: text("error"),
    /** Warnungen, Plausibilitätsbefunde, Quoten-Kontingent usw. */
    details: jsonb("details").$type<Record<string, unknown>>(),
  },
  (t) => [index("job_runs_job_started_idx").on(t.job, t.startedAt)],
);

export const dataConflicts = pgTable(
  "data_conflicts",
  {
    id: serial("id").primaryKey(),
    entityType: entityType("entity_type").notNull(),
    entityId: integer("entity_id").notNull(),
    field: text("field").notNull(),
    keptSourceId: integer("kept_source_id")
      .notNull()
      .references(() => dataSources.id),
    keptValue: text("kept_value"),
    otherSourceId: integer("other_source_id")
      .notNull()
      .references(() => dataSources.id),
    otherValue: text("other_value"),
    /** true = Abweichung groß genug, um den Wert als „ungesichert“ zu zeigen. */
    unconfirmed: boolean("unconfirmed").notNull(),
    detectedAt: tstz("detected_at").notNull().defaultNow(),
  },
  (t) => [index("data_conflicts_entity_idx").on(t.entityType, t.entityId)],
);
