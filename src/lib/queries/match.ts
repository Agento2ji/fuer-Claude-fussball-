import "server-only";
import { cache } from "react";
import { and, asc, desc, eq, gt, inArray, isNotNull, lt, or } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { getDb } from "@/db";
import { broadcasts, competitions, lineups, matches, players, teams } from "@/db/schema";
import { headToHead } from "@/lib/match";
import { computeStandings } from "@/lib/standings";
import { getAvailability } from "./availability";
import { getForms } from "./form";
import { sourceResolver } from "./sources";

export type MatchPageData = NonNullable<Awaited<ReturnType<typeof getMatchPageUncached>>>;

async function getMatchPageUncached(matchId: number) {
  const db = getDb();
  const ref = await sourceResolver();
  const home = alias(teams, "home");
  const away = alias(teams, "away");

  const [row] = await db
    .select({ m: matches, competition: competitions, homeName: home.name, awayName: away.name })
    .from(matches)
    .innerJoin(competitions, eq(competitions.id, matches.competitionId))
    .innerJoin(home, eq(home.id, matches.homeTeamId))
    .innerJoin(away, eq(away.id, matches.awayTeamId))
    .where(eq(matches.id, matchId));
  if (!row) return null;
  const { m } = row;
  const teamIds = [m.homeTeamId, m.awayTeamId];

  // Tabellenplätze im Wettbewerb und in der Saison dieses Spiels.
  const seasonMatches = await db
    .select({ homeTeamId: matches.homeTeamId, awayTeamId: matches.awayTeamId, homeScore: matches.homeScore, awayScore: matches.awayScore, kickoffAt: matches.kickoffAt })
    .from(matches)
    .where(and(eq(matches.competitionId, m.competitionId), eq(matches.season, m.season), lt(matches.kickoffAt, m.kickoffAt)));
  const ids = [...new Set(seasonMatches.flatMap((x) => [x.homeTeamId, x.awayTeamId]).concat(teamIds))];
  const names = new Map(
    (await db.select({ id: teams.id, name: teams.name }).from(teams).where(inArray(teams.id, ids))).map((t) => [t.id, t.name]),
  );
  const table = computeStandings(
    seasonMatches
      .filter((x) => x.homeScore !== null && x.awayScore !== null)
      .map((x) => ({ ...x, homeScore: x.homeScore!, awayScore: x.awayScore! })),
    names,
  );

  // Form: letzte 5 Ergebnisse je Team vor diesem Spiel, alle Wettbewerbe.
  const recent = await db
    .select({ id: matches.id, homeTeamId: matches.homeTeamId, awayTeamId: matches.awayTeamId, homeScore: matches.homeScore, awayScore: matches.awayScore, kickoffAt: matches.kickoffAt })
    .from(matches)
    .where(
      and(
        or(inArray(matches.homeTeamId, teamIds), inArray(matches.awayTeamId, teamIds)),
        lt(matches.kickoffAt, m.kickoffAt),
        isNotNull(matches.homeScore),
        isNotNull(matches.awayScore),
      ),
    )
    .orderBy(desc(matches.kickoffAt))
    .limit(60);
  const formOf = (teamId: number) =>
    recent
      .filter((x) => x.homeTeamId === teamId || x.awayTeamId === teamId)
      .slice(0, 5)
      .map((x) => {
        const isHome = x.homeTeamId === teamId;
        const own = isHome ? x.homeScore! : x.awayScore!;
        const opp = isHome ? x.awayScore! : x.homeScore!;
        return { id: x.id, outcome: (own > opp ? "S" : own < opp ? "N" : "U") as "S" | "U" | "N" };
      });

  // Direkter Vergleich: alle bisherigen Duelle, neueste zuerst.
  const duelRows = await db
    .select({ m: matches, competitionName: competitions.name })
    .from(matches)
    .innerJoin(competitions, eq(competitions.id, matches.competitionId))
    .where(
      and(
        or(
          and(eq(matches.homeTeamId, m.homeTeamId), eq(matches.awayTeamId, m.awayTeamId)),
          and(eq(matches.homeTeamId, m.awayTeamId), eq(matches.awayTeamId, m.homeTeamId)),
        ),
        lt(matches.kickoffAt, m.kickoffAt),
        isNotNull(matches.homeScore),
        isNotNull(matches.awayScore),
      ),
    )
    .orderBy(desc(matches.kickoffAt));
  const duels = duelRows.map((d) => ({
    id: d.m.id,
    kickoffAt: d.m.kickoffAt,
    competitionName: d.competitionName,
    homeTeamId: d.m.homeTeamId,
    awayTeamId: d.m.awayTeamId,
    homeScore: d.m.homeScore!,
    awayScore: d.m.awayScore!,
  }));

  // Aufstellungen: bestätigte haben Vorrang vor voraussichtlichen.
  const lineupRows = await db
    .select({ l: lineups, name: players.name, position: players.position })
    .from(lineups)
    .innerJoin(players, eq(players.id, lineups.playerId))
    .where(eq(lineups.matchId, matchId))
    .orderBy(asc(lineups.shirtNumber));
  const lineupFor = (teamId: number) => {
    const forTeam = lineupRows.filter((r) => r.l.teamId === teamId);
    const confirmed = forTeam.filter((r) => !r.l.isProbable);
    const chosen = confirmed.length > 0 ? confirmed : forTeam.filter((r) => r.l.isProbable);
    if (chosen.length === 0) return null;
    const first = chosen[0]!.l;
    return {
      isProbable: first.isProbable,
      formation: first.formation,
      source: ref(first.sourceId, first.fetchedAt, first.sourceUrl),
      starters: chosen.filter((r) => r.l.isStarter).map((r) => ({ id: r.l.playerId, name: r.name, position: r.position, shirtNumber: r.l.shirtNumber })),
      bench: chosen.filter((r) => !r.l.isStarter).map((r) => ({ id: r.l.playerId, name: r.name, position: r.position, shirtNumber: r.l.shirtNumber })),
    };
  };
  const homeLineup = lineupFor(m.homeTeamId);
  const awayLineup = lineupFor(m.awayTeamId);

  const [homeAvailability, awayAvailability, tv, forms] = await Promise.all([
    getAvailability(m.homeTeamId),
    getAvailability(m.awayTeamId),
    db.select().from(broadcasts).where(and(eq(broadcasts.matchId, matchId), eq(broadcasts.country, "DE"))),
    getForms([...(homeLineup?.starters ?? []), ...(awayLineup?.starters ?? [])].map((p) => p.id)),
  ]);

  const side = (teamId: number, name: string) => ({
    id: teamId,
    name,
    position: table.find((r) => r.teamId === teamId)?.position ?? null,
    form: formOf(teamId),
  });

  return {
    match: m,
    competition: row.competition,
    source: ref(m.sourceId, m.fetchedAt, m.sourceUrl),
    tableSize: table.length,
    home: { ...side(m.homeTeamId, row.homeName), lineup: homeLineup, availability: homeAvailability },
    away: { ...side(m.awayTeamId, row.awayName), lineup: awayLineup, availability: awayAvailability },
    duels,
    h2h: headToHead(duels, m.homeTeamId),
    broadcasts: tv.map((b) => ({ ...b, source: ref(b.sourceId, b.fetchedAt, b.sourceUrl) })),
    forms,
  };
}

/** Die nächsten Spiele über alle Wettbewerbe – für die Startseite. */
export async function upcomingMatches(now: Date, limit = 8) {
  const home = alias(teams, "home");
  const away = alias(teams, "away");
  return getDb()
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
    .where(
      and(
        eq(matches.status, "scheduled"),
        gt(matches.kickoffAt, now),
        lt(matches.kickoffAt, new Date(now.getTime() + 14 * 86_400_000)),
      ),
    )
    .orderBy(asc(competitions.isTestData), asc(matches.kickoffAt))
    .limit(limit);
}

/** Je Anfrage nur einmal geladen – Seite und Metadaten teilen sich das Ergebnis. */
export const getMatchPage = cache(getMatchPageUncached);
