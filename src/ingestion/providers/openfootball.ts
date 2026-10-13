import { z } from "zod";
import {
  CURRENT_SEASON,
  type CompetitionConfig,
  getCompetition,
} from "@/config/competitions";
import { CACHE_TTL_SECONDS } from "@/config/providers";
import { zonedTimeToUtc } from "@/lib/time";
import { fetchJson, type FetchJsonOptions } from "../http";
import type { MatchProvider, MatchRecord, Sourced } from "../types";

/**
 * openfootball/football.json – gemeinfreie Spielpläne und Ergebnisse.
 * https://github.com/openfootball/football.json
 *
 * Eigenheiten des Formats:
 * - `score` fehlt bei offenen Spielen, ist sonst `{ ht, ft }` oder nur `[h, a]`.
 * - `time` fehlt oft; dann ist nur das Datum bekannt.
 * - Zeiten sind Ortszeit der Liga, ohne Zeitzonenangabe.
 * - Es gibt keine IDs; die externe ID wird aus Datum und Teams gebildet.
 */

const scorePair = z.tuple([z.number().int(), z.number().int()]);

const matchSchema = z.object({
  round: z.string().optional(),
  date: z.iso.date(),
  time: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .optional(),
  team1: z.string().min(1),
  team2: z.string().min(1),
  score: z
    .union([
      scorePair,
      z.object({ ft: scorePair.optional(), ht: scorePair.optional() }),
    ])
    .optional(),
});

export const openfootballFileSchema = z.object({
  name: z.string(),
  matches: z.array(matchSchema),
});

export type OpenfootballFile = z.infer<typeof openfootballFileSchema>;

const BASE_URL =
  "https://raw.githubusercontent.com/openfootball/football.json/master";

/** Platzhalter-Uhrzeit, wenn nur das Datum bekannt ist (Ortszeit). */
const UNKNOWN_TIME = "12:00";

export function openfootballUrl(fileKey: string, startYear: number): string {
  const folder = `${startYear}-${String((startYear + 1) % 100).padStart(2, "0")}`;
  return `${BASE_URL}/${folder}/${fileKey}.json`;
}

function slug(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/** Wandelt eine openfootball-Datei in normalisierte Spiele um. Rein, ohne I/O. */
export function parseOpenfootball(
  file: OpenfootballFile,
  competition: Pick<CompetitionConfig, "code" | "timezone">,
  season: string,
  fetchedAt: Date,
  sourceUrl: string,
): Sourced<MatchRecord>[] {
  return file.matches.map((m) => {
    const ft = Array.isArray(m.score) ? m.score : m.score?.ft;
    const matchday = m.round?.match(/(\d+)/)?.[1];
    const kickoffAt = zonedTimeToUtc(
      m.date,
      m.time ?? UNKNOWN_TIME,
      competition.timezone,
    );
    return {
      externalId: `${competition.code}:${m.date}:${slug(m.team1)}:${slug(m.team2)}`,
      competitionCode: competition.code,
      season,
      matchday: matchday ? Number(matchday) : null,
      stage: m.round ?? null,
      homeTeam: { externalId: slug(m.team1), name: m.team1 },
      awayTeam: { externalId: slug(m.team2), name: m.team2 },
      kickoffAt,
      kickoffTimeKnown: m.time !== undefined,
      status: ft ? "finished" : "scheduled",
      homeScore: ft ? ft[0] : null,
      awayScore: ft ? ft[1] : null,
      provenance: { source: "openfootball", fetchedAt, sourceUrl },
    };
  });
}

export class OpenfootballProvider implements MatchProvider {
  readonly key = "openfootball";

  constructor(
    private readonly fetchOptions: Partial<
      Pick<FetchJsonOptions<unknown>, "fetchImpl" | "cache" | "sleep">
    > = {},
  ) {}

  isAvailable(): boolean {
    return true;
  }

  supports(competitionCode: string): boolean {
    return Boolean(getCompetition(competitionCode)?.providerIds.openfootball);
  }

  async getMatches(competitionCode: string): Promise<Sourced<MatchRecord>[]> {
    const competition = getCompetition(competitionCode);
    const fileKey = competition?.providerIds.openfootball;
    if (!competition || !fileKey) {
      throw new Error(`openfootball führt ${competitionCode} nicht`);
    }
    const url = openfootballUrl(fileKey, CURRENT_SEASON.startYear);
    const { data, fetchedAt } = await fetchJson({
      ...this.fetchOptions,
      provider: this.key,
      url,
      schema: openfootballFileSchema,
      ttlSeconds: CACHE_TTL_SECONDS.matches,
    });
    return parseOpenfootball(
      data,
      competition,
      CURRENT_SEASON.label,
      fetchedAt,
      url,
    );
  }
}
