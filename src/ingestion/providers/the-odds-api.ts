import { z } from "zod";
import { BOOKMAKERS } from "@/config/bookmakers";
import { getCompetition } from "@/config/competitions";
import { CACHE_TTL_SECONDS } from "@/config/providers";
import { fetchJson, type FetchJsonOptions } from "../http";
import type { OddsProvider, OddsRecord, Sourced } from "../types";

/**
 * The Odds API v4 – https://the-odds-api.com/liveapi/guides/v4/
 *
 * Nur aktiv mit THE_ODDS_API_KEY. Abgefragt werden nur die konfigurierten
 * Buchmacher. Kosten: 1 Credit je Markt und je 10 Buchmacher, also hier
 * 2 Credits je Wettbewerb (h2h + totals). Format nach der offiziellen
 * Dokumentation; gegen die Live-API noch nicht geprüft.
 */

const MARKETS = ["h2h", "totals"] as const;

const outcomeSchema = z.object({
  name: z.string(),
  price: z.number().gt(1),
  point: z.number().optional(),
});

const eventSchema = z.object({
  id: z.string(),
  commence_time: z.iso.datetime({ offset: true }),
  home_team: z.string(),
  away_team: z.string(),
  bookmakers: z.array(
    z.object({
      key: z.string(),
      last_update: z.iso.datetime({ offset: true }).optional(),
      markets: z.array(
        z.object({
          key: z.string(),
          last_update: z.iso.datetime({ offset: true }).optional(),
          outcomes: z.array(outcomeSchema),
        }),
      ),
    }),
  ),
});

export const oddsApiResponseSchema = z.array(eventSchema);
export type OddsApiResponse = z.infer<typeof oddsApiResponseSchema>;

const bookmakerByApiKey: Map<string, string> = new Map(
  BOOKMAKERS.map((b) => [b.oddsApiKey, b.key]),
);

export function parseOddsApi(
  events: OddsApiResponse,
  fetchedAt: Date,
  sourceUrl: string,
): Sourced<OddsRecord>[] {
  const out: Sourced<OddsRecord>[] = [];
  for (const ev of events) {
    const match = {
      externalId: ev.id,
      homeTeamName: ev.home_team,
      awayTeamName: ev.away_team,
      kickoffAt: new Date(ev.commence_time),
    };
    for (const bm of ev.bookmakers) {
      const bookmakerKey = bookmakerByApiKey.get(bm.key);
      if (!bookmakerKey) continue;
      for (const market of bm.markets) {
        const updated = market.last_update ?? bm.last_update;
        for (const o of market.outcomes) {
          let selection: string;
          let line: number | null = null;
          if (market.key === "h2h") {
            selection =
              o.name === ev.home_team
                ? "home"
                : o.name === ev.away_team
                  ? "away"
                  : o.name === "Draw"
                    ? "draw"
                    : "";
          } else if (market.key === "totals") {
            selection = o.name.toLowerCase();
            line = o.point ?? null;
            if (line === null) continue;
          } else {
            continue;
          }
          if (!selection) continue;
          out.push({
            match,
            bookmakerKey,
            market: market.key as OddsRecord["market"],
            selection,
            line,
            price: o.price,
            bookmakerUpdatedAt: updated ? new Date(updated) : null,
            provenance: { source: "the-odds-api", fetchedAt, sourceUrl },
          });
        }
      }
    }
  }
  return out;
}

export class TheOddsApiProvider implements OddsProvider {
  readonly key = "the-odds-api";
  /** Restkontingent laut letzter Antwort, fürs Job-Protokoll. */
  lastQuota: Record<string, string> = {};

  constructor(
    private readonly apiKey: string | undefined = process.env.THE_ODDS_API_KEY,
    private readonly fetchOptions: Partial<
      Pick<FetchJsonOptions<unknown>, "fetchImpl" | "cache" | "sleep">
    > = {},
  ) {}

  isAvailable(): boolean {
    return Boolean(this.apiKey);
  }

  supports(competitionCode: string): boolean {
    return Boolean(getCompetition(competitionCode)?.providerIds.theOddsApi);
  }

  async getOdds(competitionCode: string): Promise<Sourced<OddsRecord>[]> {
    const sport = getCompetition(competitionCode)?.providerIds.theOddsApi;
    if (!sport || !this.apiKey) {
      throw new Error(`The Odds API nicht nutzbar für ${competitionCode}`);
    }
    const params = new URLSearchParams({
      apiKey: this.apiKey,
      bookmakers: BOOKMAKERS.map((b) => b.oddsApiKey).join(","),
      markets: MARKETS.join(","),
      oddsFormat: "decimal",
      dateFormat: "iso",
    });
    const url = `https://api.the-odds-api.com/v4/sports/${sport}/odds?${params}`;
    const { data, fetchedAt, headers } = await fetchJson({
      ...this.fetchOptions,
      provider: this.key,
      url,
      schema: oddsApiResponseSchema,
      ttlSeconds: CACHE_TTL_SECONDS.odds,
    });
    this.lastQuota = headers;
    // Ohne Key in der gespeicherten Quell-URL.
    const publicUrl = `https://api.the-odds-api.com/v4/sports/${sport}/odds`;
    return parseOddsApi(data, fetchedAt, publicUrl);
  }
}
