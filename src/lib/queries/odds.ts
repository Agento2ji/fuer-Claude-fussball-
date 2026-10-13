import "server-only";
import { and, asc, eq, gt, inArray, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { getDb } from "@/db";
import { bookmakers, competitions, matches, oddsSnapshots, teams } from "@/db/schema";
import { analyzeMarket, type MarketAnalysis, type MarketInput, valueBets } from "@/lib/odds/value";
import { sourceResolver } from "./sources";

/** Feste Reihenfolge der Ausgänge je Markt. */
const SELECTION_ORDER: Record<string, string[]> = {
  h2h: ["home", "draw", "away"],
  totals: ["over", "under"],
  btts: ["yes", "no"],
  double_chance: ["1X", "X2", "12"],
};

/** Neuester Snapshot je Spiel, Buchmacher, Markt, Linie und Ausgang. */
async function latestSnapshots(matchIds: number[]) {
  if (matchIds.length === 0) return [];
  return getDb()
    .selectDistinctOn(
      [oddsSnapshots.matchId, oddsSnapshots.bookmakerId, oddsSnapshots.market, oddsSnapshots.line, oddsSnapshots.selection],
      {
        matchId: oddsSnapshots.matchId,
        bookmakerKey: bookmakers.key,
        market: oddsSnapshots.market,
        line: oddsSnapshots.line,
        selection: oddsSnapshots.selection,
        price: oddsSnapshots.price,
        fetchedAt: oddsSnapshots.fetchedAt,
        sourceId: oddsSnapshots.sourceId,
        sourceUrl: oddsSnapshots.sourceUrl,
      },
    )
    .from(oddsSnapshots)
    .innerJoin(bookmakers, eq(bookmakers.id, oddsSnapshots.bookmakerId))
    .where(inArray(oddsSnapshots.matchId, matchIds))
    .orderBy(
      oddsSnapshots.matchId,
      oddsSnapshots.bookmakerId,
      oddsSnapshots.market,
      oddsSnapshots.line,
      oddsSnapshots.selection,
      sql`${oddsSnapshots.fetchedAt} desc`,
    );
}

type Snapshot = Awaited<ReturnType<typeof latestSnapshots>>[number];

function toMarketInputs(rows: Snapshot[]): MarketInput[] {
  const groups = new Map<string, MarketInput>();
  for (const r of rows) {
    const key = `${r.market}|${r.line ?? ""}`;
    let g = groups.get(key);
    if (!g) {
      g = { market: r.market, line: r.line, selections: [], quotes: {} };
      groups.set(key, g);
    }
    if (!g.selections.includes(r.selection)) g.selections.push(r.selection);
    g.quotes[r.bookmakerKey] ??= {};
    g.quotes[r.bookmakerKey]![r.selection] = { price: r.price, fetchedAt: r.fetchedAt };
  }
  const markets = [...groups.values()];
  for (const m of markets) {
    const order = SELECTION_ORDER[m.market];
    if (order) m.selections.sort((a, b) => order.indexOf(a) - order.indexOf(b));
  }
  const marketOrder = Object.keys(SELECTION_ORDER);
  return markets.sort(
    (a, b) => marketOrder.indexOf(a.market) - marketOrder.indexOf(b.market) || (a.line ?? 0) - (b.line ?? 0),
  );
}

export type MatchOdds = Awaited<ReturnType<typeof getMatchOdds>>;

export async function getMatchOdds(matchId: number, now: Date = new Date()) {
  const rows = await latestSnapshots([matchId]);
  const ref = await sourceResolver();
  const markets = toMarketInputs(rows)
    .map((m) => analyzeMarket(m, now))
    .filter((m): m is MarketAnalysis => m !== null);
  const newest = rows.sort((a, b) => b.fetchedAt.getTime() - a.fetchedAt.getTime())[0];
  return {
    markets,
    ...valueBets(markets),
    source: newest ? ref(newest.sourceId, newest.fetchedAt, newest.sourceUrl) : null,
  };
}

/** Übersicht: kommende Spiele mit Quoten und ihrer besten Value-Wette. */
export async function getValueOverview(now: Date = new Date(), limit = 20) {
  const home = alias(teams, "home");
  const away = alias(teams, "away");
  const withOdds = getDb()
    .selectDistinct({ matchId: oddsSnapshots.matchId })
    .from(oddsSnapshots);
  const upcoming = await getDb()
    .select({
      id: matches.id,
      kickoffAt: matches.kickoffAt,
      kickoffTimeKnown: matches.kickoffTimeKnown,
      competition: competitions.name,
      isTestData: competitions.isTestData,
      homeName: home.name,
      awayName: away.name,
    })
    .from(matches)
    .innerJoin(competitions, eq(competitions.id, matches.competitionId))
    .innerJoin(home, eq(home.id, matches.homeTeamId))
    .innerJoin(away, eq(away.id, matches.awayTeamId))
    .where(and(gt(matches.kickoffAt, now), inArray(matches.id, withOdds)))
    .orderBy(asc(matches.kickoffAt))
    .limit(limit);

  const rows = await latestSnapshots(upcoming.map((m) => m.id));
  return upcoming.map((m) => {
    const markets = toMarketInputs(rows.filter((r) => r.matchId === m.id))
      .map((x) => analyzeMarket(x, now))
      .filter((x): x is MarketAnalysis => x !== null);
    const { all, top } = valueBets(markets);
    return { ...m, valueCount: all.length, best: top[0] ?? null };
  });
}
