import "server-only";
import { and, asc, desc, eq, gt, inArray, isNull, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { getDb } from "@/db";
import { sourceResolver } from "./sources";
import {
  cards,
  competitions,
  contracts,
  injuries,
  matches,
  playerMatchStats,
  players,
  suspensions,
  teams,
} from "@/db/schema";

export async function listPlayers() {
  const db = getDb();
  return db
    .select({
      id: players.id,
      name: players.name,
      position: players.position,
      shirtNumber: players.shirtNumber,
      teamId: teams.id,
      teamName: teams.name,
    })
    .from(players)
    .innerJoin(teams, eq(teams.id, players.currentTeamId))
    .orderBy(asc(teams.name), asc(players.shirtNumber));
}

export type PlayerPageData = NonNullable<Awaited<ReturnType<typeof getPlayerPage>>>;

export async function getPlayerPage(playerId: number, now: Date = new Date()) {
  const db = getDb();
  const ref = await sourceResolver();

  const [p] = await db
    .select({ player: players, team: teams })
    .from(players)
    .leftJoin(teams, eq(teams.id, players.currentTeamId))
    .where(eq(players.id, playerId));
  if (!p) return null;

  // Spiele des Spielers mit Gegner und Wettbewerb, neueste zuerst.
  const home = alias(teams, "home");
  const away = alias(teams, "away");
  const statRows = await db
    .select({
      stats: playerMatchStats,
      match: matches,
      competition: { id: competitions.id, code: competitions.code, name: competitions.name },
      homeName: home.name,
      awayName: away.name,
    })
    .from(playerMatchStats)
    .innerJoin(matches, eq(matches.id, playerMatchStats.matchId))
    .innerJoin(competitions, eq(competitions.id, matches.competitionId))
    .innerJoin(home, eq(home.id, matches.homeTeamId))
    .innerJoin(away, eq(away.id, matches.awayTeamId))
    .where(eq(playerMatchStats.playerId, playerId))
    .orderBy(desc(matches.kickoffAt));

  const games = statRows.map((r) => {
    const isHome = r.match.homeTeamId === r.stats.teamId;
    const own = isHome ? r.match.homeScore : r.match.awayScore;
    const opp = isHome ? r.match.awayScore : r.match.homeScore;
    return {
      matchId: r.match.id,
      kickoffAt: r.match.kickoffAt,
      competition: r.competition,
      opponent: isHome ? r.awayName : r.homeName,
      isHome,
      result: own === null || opp === null ? null : { own, opp, outcome: own > opp ? "S" : own < opp ? "N" : "U" },
      stats: r.stats,
      source: ref(r.stats.sourceId, r.stats.fetchedAt, r.stats.sourceUrl),
    };
  });

  // Hauptwettbewerb = der mit den meisten Einsätzen.
  const byComp = new Map<number, number>();
  for (const g of games) byComp.set(g.competition.id, (byComp.get(g.competition.id) ?? 0) + 1);
  const mainCompId = [...byComp.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  const mainCompetition = games.find((g) => g.competition.id === mainCompId)?.competition ?? null;

  const [injury] = await db
    .select()
    .from(injuries)
    .where(and(eq(injuries.playerId, playerId), isNull(injuries.endedAt)))
    .orderBy(desc(injuries.since))
    .limit(1);

  const [suspension] = await db
    .select({ s: suspensions, competitionName: competitions.name })
    .from(suspensions)
    .leftJoin(competitions, eq(competitions.id, suspensions.competitionId))
    .where(and(eq(suspensions.playerId, playerId), eq(suspensions.active, true)))
    .limit(1);

  // Wann darf er wieder? Das (n+1)-te Spiel seines Teams nach dem auslösenden Spiel.
  let suspensionDetail: {
    missedMatches: { kickoffAt: Date; opponent: string }[];
    firstEligible: { kickoffAt: Date; opponent: string } | null;
  } | null = null;
  if (suspension && p.team) {
    const [trigger] = suspension.s.triggeredByMatchId
      ? await db.select({ kickoffAt: matches.kickoffAt }).from(matches).where(eq(matches.id, suspension.s.triggeredByMatchId))
      : [];
    const upcoming = await db
      .select({ kickoffAt: matches.kickoffAt, homeTeamId: matches.homeTeamId, homeName: home.name, awayName: away.name })
      .from(matches)
      .innerJoin(home, eq(home.id, matches.homeTeamId))
      .innerJoin(away, eq(away.id, matches.awayTeamId))
      .where(
        and(
          or(eq(matches.homeTeamId, p.team.id), eq(matches.awayTeamId, p.team.id)),
          gt(matches.kickoffAt, trigger?.kickoffAt ?? now),
          suspension.s.competitionId ? eq(matches.competitionId, suspension.s.competitionId) : undefined,
        ),
      )
      .orderBy(asc(matches.kickoffAt))
      .limit(suspension.s.matchesCount + 1);
    const named = upcoming.map((m) => ({
      kickoffAt: m.kickoffAt,
      opponent: m.homeTeamId === p.team!.id ? m.awayName : m.homeName,
    }));
    suspensionDetail = {
      missedMatches: named.slice(0, suspension.s.matchesCount),
      firstEligible: named[suspension.s.matchesCount] ?? null,
    };
  }

  // Gelbe Karten je Wettbewerb (getrennt gezählt) mit Sperrgrenze.
  const yellowRows = await db
    .select({
      competitionId: cards.competitionId,
      name: competitions.name,
      threshold: competitions.yellowCardSuspensionThreshold,
      count: sql<number>`count(*)::int`,
      fetchedAt: sql<Date>`max(${cards.fetchedAt})`,
      sourceId: sql<number>`min(${cards.sourceId})`,
    })
    .from(cards)
    .innerJoin(competitions, eq(competitions.id, cards.competitionId))
    .where(and(eq(cards.playerId, playerId), eq(cards.type, "yellow")))
    .groupBy(cards.competitionId, competitions.name, competitions.yellowCardSuspensionThreshold);

  const [contract] = await db
    .select()
    .from(contracts)
    .where(eq(contracts.playerId, playerId))
    .orderBy(desc(contracts.endDate))
    .limit(1);

  const [nextMatch] = p.team
    ? await db
        .select({ kickoffAt: matches.kickoffAt, kickoffTimeKnown: matches.kickoffTimeKnown, homeTeamId: matches.homeTeamId, homeName: home.name, awayName: away.name, competition: competitions.name })
        .from(matches)
        .innerJoin(home, eq(home.id, matches.homeTeamId))
        .innerJoin(away, eq(away.id, matches.awayTeamId))
        .innerJoin(competitions, eq(competitions.id, matches.competitionId))
        .where(and(or(eq(matches.homeTeamId, p.team.id), eq(matches.awayTeamId, p.team.id)), gt(matches.kickoffAt, now), inArray(matches.status, ["scheduled", "postponed"])))
        .orderBy(asc(matches.kickoffAt))
        .limit(1)
    : [];

  return {
    player: p.player,
    team: p.team,
    playerSource: ref(p.player.sourceId, p.player.fetchedAt, p.player.sourceUrl),
    games,
    mainCompetition,
    injury: injury
      ? { ...injury, source: ref(injury.sourceId, injury.fetchedAt, injury.sourceUrl) }
      : null,
    suspension: suspension
      ? {
          ...suspension.s,
          competitionName: suspension.competitionName,
          source: ref(suspension.s.sourceId, suspension.s.fetchedAt, suspension.s.sourceUrl),
          ...suspensionDetail,
        }
      : null,
    yellowCards: yellowRows.map((y) => ({
      ...y,
      source: ref(y.sourceId, new Date(y.fetchedAt), null),
    })),
    contract: contract
      ? { ...contract, source: ref(contract.sourceId, contract.fetchedAt, contract.sourceUrl) }
      : null,
    nextMatch: nextMatch
      ? {
          kickoffAt: nextMatch.kickoffAt,
          kickoffTimeKnown: nextMatch.kickoffTimeKnown,
          competition: nextMatch.competition,
          isHome: nextMatch.homeTeamId === p.team?.id,
          opponent: nextMatch.homeTeamId === p.team?.id ? nextMatch.awayName : nextMatch.homeName,
        }
      : null,
  };
}
