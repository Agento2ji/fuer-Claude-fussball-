import "server-only";
import { and, asc, desc, eq, inArray, isNull, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { CURRENT_SEASON } from "@/config/competitions";
import { getDb } from "@/db";
import {
  cards,
  competitions,
  injuries,
  matches,
  players,
  suspensions,
  teamMatchStats,
  teams,
} from "@/db/schema";
import { yellowCardRisk } from "@/lib/player-status";
import { computeStandings } from "@/lib/standings";
import { sourceResolver } from "./sources";

export type TeamPageData = NonNullable<Awaited<ReturnType<typeof getTeamPage>>>;

export async function getTeamPage(teamId: number, now: Date = new Date()) {
  const db = getDb();
  const [team] = await db.select().from(teams).where(eq(teams.id, teamId));
  if (!team) return null;
  const ref = await sourceResolver();
  const home = alias(teams, "home");
  const away = alias(teams, "away");

  const teamMatches = await db
    .select({
      m: matches,
      competition: { id: competitions.id, code: competitions.code, name: competitions.name },
      homeName: home.name,
      awayName: away.name,
    })
    .from(matches)
    .innerJoin(competitions, eq(competitions.id, matches.competitionId))
    .innerJoin(home, eq(home.id, matches.homeTeamId))
    .innerJoin(away, eq(away.id, matches.awayTeamId))
    .where(or(eq(matches.homeTeamId, teamId), eq(matches.awayTeamId, teamId)))
    .orderBy(asc(matches.kickoffAt));

  const view = teamMatches.map((r) => {
    const isHome = r.m.homeTeamId === teamId;
    const own = isHome ? r.m.homeScore : r.m.awayScore;
    const opp = isHome ? r.m.awayScore : r.m.homeScore;
    return {
      id: r.m.id,
      kickoffAt: r.m.kickoffAt,
      kickoffTimeKnown: r.m.kickoffTimeKnown,
      status: r.m.status,
      competition: r.competition,
      isHome,
      opponent: { id: isHome ? r.m.awayTeamId : r.m.homeTeamId, name: isHome ? r.awayName : r.homeName },
      result: own === null || opp === null ? null : { own, opp, outcome: (own > opp ? "S" : own < opp ? "N" : "U") as "S" | "U" | "N" },
      source: ref(r.m.sourceId, r.m.fetchedAt, r.m.sourceUrl),
    };
  });

  // Hauptwettbewerb = der mit den meisten Spielen.
  const counts = new Map<number, number>();
  for (const v of view) counts.set(v.competition.id, (counts.get(v.competition.id) ?? 0) + 1);
  const mainCompId = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  const mainCompetition = view.find((v) => v.competition.id === mainCompId)?.competition ?? null;

  // Tabelle des Hauptwettbewerbs, um Platz, Punkte, Tordifferenz zu zeigen.
  let standing = null;
  let tableSize = 0;
  if (mainCompId) {
    const compMatches = await db
      .select({ homeTeamId: matches.homeTeamId, awayTeamId: matches.awayTeamId, homeScore: matches.homeScore, awayScore: matches.awayScore, kickoffAt: matches.kickoffAt })
      .from(matches)
      .where(and(eq(matches.competitionId, mainCompId), eq(matches.season, CURRENT_SEASON.label)));
    const ids = [...new Set(compMatches.flatMap((m) => [m.homeTeamId, m.awayTeamId]))];
    const names = new Map(
      (await db.select({ id: teams.id, name: teams.name }).from(teams).where(inArray(teams.id, ids))).map((t) => [t.id, t.name]),
    );
    const table = computeStandings(
      compMatches
        .filter((m) => m.homeScore !== null && m.awayScore !== null)
        .map((m) => ({ ...m, homeScore: m.homeScore!, awayScore: m.awayScore! })),
      names,
    );
    standing = table.find((r) => r.teamId === teamId) ?? null;
    tableSize = table.length;
  }

  const played = view.filter((v) => v.result).reverse();
  const nextMatch = view.find((v) => v.kickoffAt > now && v.status !== "cancelled") ?? null;

  // Teamstatistik je Spiel, neueste zuerst.
  const statRows = await db
    .select({ s: teamMatchStats, kickoffAt: matches.kickoffAt, matchId: matches.id })
    .from(teamMatchStats)
    .innerJoin(matches, eq(matches.id, teamMatchStats.matchId))
    .where(and(eq(teamMatchStats.teamId, teamId), eq(matches.season, CURRENT_SEASON.label)))
    .orderBy(desc(matches.kickoffAt));
  const opponentByMatch = new Map(view.map((v) => [v.id, v.opponent.name]));
  const stats = statRows.map((r) => ({
    ...r.s,
    kickoffAt: r.kickoffAt,
    opponent: opponentByMatch.get(r.matchId) ?? "?",
    source: ref(r.s.sourceId, r.s.fetchedAt, r.s.sourceUrl),
  }));

  // Kader mit Verfügbarkeit.
  const squad = await db
    .select({ id: players.id, name: players.name, position: players.position, shirtNumber: players.shirtNumber })
    .from(players)
    .where(eq(players.currentTeamId, teamId))
    .orderBy(asc(players.shirtNumber));
  const squadIds = squad.map((p) => p.id);

  const activeInjuries = squadIds.length
    ? await db.select().from(injuries).where(and(inArray(injuries.playerId, squadIds), isNull(injuries.endedAt)))
    : [];
  const activeSuspensions = squadIds.length
    ? await db
        .select({ s: suspensions, competitionName: competitions.name })
        .from(suspensions)
        .leftJoin(competitions, eq(competitions.id, suspensions.competitionId))
        .where(and(inArray(suspensions.playerId, squadIds), eq(suspensions.active, true)))
    : [];
  const yellow = squadIds.length
    ? await db
        .select({
          playerId: cards.playerId,
          competitionName: competitions.name,
          threshold: competitions.yellowCardSuspensionThreshold,
          count: sql<number>`count(*)::int`,
        })
        .from(cards)
        .innerJoin(competitions, eq(competitions.id, cards.competitionId))
        .innerJoin(matches, eq(matches.id, cards.matchId))
        .where(and(inArray(cards.playerId, squadIds), eq(cards.type, "yellow"), eq(matches.season, CURRENT_SEASON.label)))
        .groupBy(cards.playerId, competitions.name, competitions.yellowCardSuspensionThreshold)
    : [];

  const byId = new Map(squad.map((p) => [p.id, p]));
  const absences = [
    ...activeSuspensions.map((x) => ({
      player: byId.get(x.s.playerId)!,
      kind: "gesperrt" as const,
      detail: `${x.s.matchesCount} ${x.s.matchesCount === 1 ? "Spiel" : "Spiele"}${x.competitionName ? ` · ${x.competitionName}` : ""}`,
      expectedReturn: null as string | null,
      source: ref(x.s.sourceId, x.s.fetchedAt, x.s.sourceUrl),
    })),
    ...activeInjuries.map((i) => ({
      player: byId.get(i.playerId)!,
      kind: i.status === "injured" ? ("verletzt" as const) : ("angeschlagen" as const),
      detail: i.injuryType ?? "",
      expectedReturn: i.expectedReturn,
      source: ref(i.sourceId, i.fetchedAt, i.sourceUrl),
    })),
  ];
  const atRisk = yellow
    .filter((y) => yellowCardRisk(y.count, y.threshold).atRisk)
    .map((y) => ({ player: byId.get(y.playerId)!, count: y.count, competitionName: y.competitionName }));

  return {
    team,
    teamSource: ref(team.sourceId, team.fetchedAt, team.sourceUrl),
    mainCompetition,
    standing,
    tableSize,
    form: played.slice(0, 5),
    nextMatch,
    stats,
    squad,
    absences,
    atRisk,
  };
}
