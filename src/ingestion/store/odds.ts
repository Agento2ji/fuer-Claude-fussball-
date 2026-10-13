import { and, between, eq } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { bookmakers, competitions, matches, oddsSnapshots, teams } from "@/db/schema";
import { sameTeam } from "../team-names";
import type { OddsRecord, Sourced } from "../types";
import { type DbLike, type SourceInfo, link, loadMappings, requireSource } from "./common";

export interface WriteOddsResult {
  inserted: number;
  unmatchedEvents: string[];
}

/** Zeitfenster für die Zuordnung eines Quoten-Events zu einem Spiel. */
const MATCH_WINDOW_MS = 36 * 60 * 60 * 1000;

/**
 * Hängt Quoten als neue Snapshots an (append-only). Events, die keinem
 * Spiel eindeutig zugeordnet werden können, werden gemeldet, nicht geraten.
 */
export async function writeOdds(
  db: DbLike,
  sources: Map<string, SourceInfo>,
  competitionCode: string,
  records: Sourced<OddsRecord>[],
): Promise<WriteOddsResult> {
  const result: WriteOddsResult = { inserted: 0, unmatchedEvents: [] };
  if (records.length === 0) return result;
  const source = requireSource(sources, records[0]!.provenance.source);

  const bookmakerIds = new Map(
    (await db.select({ id: bookmakers.id, key: bookmakers.key }).from(bookmakers)).map(
      (b) => [b.key, b.id],
    ),
  );
  const [competition] = await db
    .select({ id: competitions.id })
    .from(competitions)
    .where(eq(competitions.code, competitionCode));
  if (!competition) throw new Error(`Wettbewerb ${competitionCode} fehlt`);

  const matchMap = await loadMappings(db, source.id, "match");
  const home = alias(teams, "home");
  const away = alias(teams, "away");

  const resolveMatch = async (ev: OddsRecord["match"]): Promise<number | undefined> => {
    const mapped = matchMap.get(ev.externalId);
    if (mapped) return mapped;
    const from = new Date(ev.kickoffAt.getTime() - MATCH_WINDOW_MS);
    const to = new Date(ev.kickoffAt.getTime() + MATCH_WINDOW_MS);
    const candidates = await db
      .select({ id: matches.id, homeName: home.name, awayName: away.name })
      .from(matches)
      .innerJoin(home, eq(home.id, matches.homeTeamId))
      .innerJoin(away, eq(away.id, matches.awayTeamId))
      .where(and(eq(matches.competitionId, competition.id), between(matches.kickoffAt, from, to)));
    const hits = candidates.filter(
      (c) => sameTeam(c.homeName, ev.homeTeamName) && sameTeam(c.awayName, ev.awayTeamName),
    );
    if (hits.length !== 1) return undefined;
    await link(db, source.id, "match", hits[0]!.id, ev.externalId);
    matchMap.set(ev.externalId, hits[0]!.id);
    return hits[0]!.id;
  };

  const rows: (typeof oddsSnapshots.$inferInsert)[] = [];
  const resolved = new Map<string, number | undefined>();
  for (const r of records) {
    if (!resolved.has(r.match.externalId)) {
      resolved.set(r.match.externalId, await resolveMatch(r.match));
    }
    const matchId = resolved.get(r.match.externalId);
    const bookmakerId = bookmakerIds.get(r.bookmakerKey);
    if (!matchId || !bookmakerId) continue;
    rows.push({
      matchId,
      bookmakerId,
      market: r.market,
      selection: r.selection,
      line: r.line,
      price: r.price,
      bookmakerUpdatedAt: r.bookmakerUpdatedAt,
      sourceId: source.id,
      fetchedAt: r.provenance.fetchedAt,
      sourceUrl: r.provenance.sourceUrl,
    });
  }
  for (const [ext, id] of resolved) {
    if (id === undefined) {
      const ev = records.find((r) => r.match.externalId === ext)!.match;
      result.unmatchedEvents.push(`${ev.homeTeamName} – ${ev.awayTeamName} (${ev.kickoffAt.toISOString()})`);
    }
  }
  for (let i = 0; i < rows.length; i += 500) {
    await db.insert(oddsSnapshots).values(rows.slice(i, i + 500));
  }
  result.inserted = rows.length;
  return result;
}
