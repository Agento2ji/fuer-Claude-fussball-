import { z } from "zod";
import { CURRENT_SEASON, getCompetition } from "@/config/competitions";
import { CACHE_TTL_SECONDS } from "@/config/providers";
import { fetchJson, type FetchJsonOptions } from "../http";
import type {
  MatchProvider,
  MatchRecord,
  MatchStatus,
  Sourced,
} from "../types";

/**
 * football-data.org v4 – https://docs.football-data.org
 *
 * Nur aktiv mit FOOTBALL_DATA_API_KEY. Format nach der offiziellen
 * Dokumentation; gegen die Live-API noch nicht geprüft, weil kein Key
 * vorliegt.
 */

const teamSchema = z.object({
  id: z.number().int().nullable(),
  name: z.string().nullable(),
  shortName: z.string().nullable().optional(),
  crest: z.string().nullable().optional(),
});

const matchSchema = z.object({
  id: z.number().int(),
  utcDate: z.iso.datetime({ offset: true }),
  status: z.string(),
  matchday: z.number().int().nullable(),
  stage: z.string().nullable().optional(),
  homeTeam: teamSchema,
  awayTeam: teamSchema,
  score: z.object({
    fullTime: z.object({
      home: z.number().int().nullable(),
      away: z.number().int().nullable(),
    }),
  }),
});

export const footballDataMatchesSchema = z.object({
  matches: z.array(matchSchema),
});

export type FootballDataMatches = z.infer<typeof footballDataMatchesSchema>;

const STATUS: Record<string, MatchStatus> = {
  SCHEDULED: "scheduled",
  TIMED: "scheduled",
  IN_PLAY: "live",
  PAUSED: "live",
  FINISHED: "finished",
  AWARDED: "finished",
  POSTPONED: "postponed",
  SUSPENDED: "postponed",
  CANCELLED: "cancelled",
};

export function parseFootballData(
  data: FootballDataMatches,
  competitionCode: string,
  season: string,
  fetchedAt: Date,
  sourceUrl: string,
): Sourced<MatchRecord>[] {
  const out: Sourced<MatchRecord>[] = [];
  for (const m of data.matches) {
    // Spiele mit noch unbekannten Teams (z. B. K.-o.-Runden) überspringen.
    if (!m.homeTeam.id || !m.homeTeam.name || !m.awayTeam.id || !m.awayTeam.name) {
      continue;
    }
    const status = STATUS[m.status] ?? "scheduled";
    const finished = status === "finished" || status === "live";
    out.push({
      externalId: String(m.id),
      competitionCode,
      season,
      matchday: m.matchday,
      stage: m.stage ?? null,
      homeTeam: {
        externalId: String(m.homeTeam.id),
        name: m.homeTeam.name,
        shortName: m.homeTeam.shortName ?? null,
      },
      awayTeam: {
        externalId: String(m.awayTeam.id),
        name: m.awayTeam.name,
        shortName: m.awayTeam.shortName ?? null,
      },
      kickoffAt: new Date(m.utcDate),
      kickoffTimeKnown: true,
      status,
      homeScore: finished ? m.score.fullTime.home : null,
      awayScore: finished ? m.score.fullTime.away : null,
      provenance: { source: "football-data", fetchedAt, sourceUrl },
    });
  }
  return out;
}

export class FootballDataProvider implements MatchProvider {
  readonly key = "football-data";

  constructor(
    private readonly apiKey: string | undefined = process.env
      .FOOTBALL_DATA_API_KEY,
    private readonly fetchOptions: Partial<
      Pick<FetchJsonOptions<unknown>, "fetchImpl" | "cache" | "sleep">
    > = {},
  ) {}

  isAvailable(): boolean {
    return Boolean(this.apiKey);
  }

  supports(competitionCode: string): boolean {
    return Boolean(getCompetition(competitionCode)?.providerIds.footballData);
  }

  async getMatches(competitionCode: string): Promise<Sourced<MatchRecord>[]> {
    const code = getCompetition(competitionCode)?.providerIds.footballData;
    if (!code || !this.apiKey) {
      throw new Error(`football-data.org nicht nutzbar für ${competitionCode}`);
    }
    const url = `https://api.football-data.org/v4/competitions/${code}/matches?season=${CURRENT_SEASON.startYear}`;
    const { data, fetchedAt } = await fetchJson({
      ...this.fetchOptions,
      provider: this.key,
      url,
      schema: footballDataMatchesSchema,
      headers: { "X-Auth-Token": this.apiKey },
      ttlSeconds: CACHE_TTL_SECONDS.matches,
    });
    return parseFootballData(
      data,
      competitionCode,
      CURRENT_SEASON.label,
      fetchedAt,
      url,
    );
  }
}
