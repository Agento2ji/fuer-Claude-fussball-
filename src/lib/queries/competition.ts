import "server-only";
import { and, asc, desc, eq, inArray, isNotNull, sql } from "drizzle-orm";
import { CURRENT_SEASON } from "@/config/competitions";
import { getDb } from "@/db";
import { competitions, matches, teams } from "@/db/schema";
import { computeStandings } from "@/lib/standings";
import { sourceResolver } from "./sources";

/** Wettbewerbe mit Spielen in der Datenbank, inklusive Anzahl. */
export async function listCompetitionsWithData() {
  return getDb()
    .select({
      code: competitions.code,
      name: competitions.name,
      isTestData: competitions.isTestData,
      matches: sql<number>`count(${matches.id})::int`,
    })
    .from(competitions)
    .leftJoin(matches, and(eq(matches.competitionId, competitions.id), eq(matches.season, CURRENT_SEASON.label)))
    .groupBy(competitions.id)
    .orderBy(asc(competitions.isTestData), asc(competitions.id));
}

export type CompetitionPageData = NonNullable<Awaited<ReturnType<typeof getCompetitionPage>>>;

export async function getCompetitionPage(code: string, now: Date = new Date()) {
  const db = getDb();
  const [competition] = await db.select().from(competitions).where(eq(competitions.code, code));
  if (!competition) return null;
  const ref = await sourceResolver();

  const rows = await db
    .select({ m: matches })
    .from(matches)
    .where(and(eq(matches.competitionId, competition.id), eq(matches.season, CURRENT_SEASON.label)))
    .orderBy(asc(matches.kickoffAt));

  const teamIds = [...new Set(rows.flatMap((r) => [r.m.homeTeamId, r.m.awayTeamId]))];
  const teamRows = teamIds.length
    ? await db.select({ id: teams.id, name: teams.name }).from(teams).where(inArray(teams.id, teamIds))
    : [];
  const names = new Map(teamRows.map((t) => [t.id, t.name]));

  const finished = rows
    .map((r) => r.m)
    .filter((m) => m.homeScore !== null && m.awayScore !== null);
  const standings = computeStandings(
    finished.map((m) => ({ homeTeamId: m.homeTeamId, awayTeamId: m.awayTeamId, homeScore: m.homeScore!, awayScore: m.awayScore!, kickoffAt: m.kickoffAt })),
    names,
  );

  // Spiele in der Vergangenheit ohne Ergebnis: Quelle hinkt hinterher.
  const overdue = rows.filter(
    (r) => r.m.homeScore === null && r.m.status === "scheduled" && now.getTime() - r.m.kickoffAt.getTime() > 36 * 3600_000,
  ).length;

  const upcoming = rows
    .map((r) => r.m)
    .filter((m) => m.kickoffAt > now && m.status !== "cancelled")
    .slice(0, 10)
    .map((m) => ({
      id: m.id,
      kickoffAt: m.kickoffAt,
      kickoffTimeKnown: m.kickoffTimeKnown,
      matchday: m.matchday,
      home: { id: m.homeTeamId, name: names.get(m.homeTeamId) ?? "?" },
      away: { id: m.awayTeamId, name: names.get(m.awayTeamId) ?? "?" },
    }));

  const latest = rows.map((r) => r.m).sort((a, b) => b.fetchedAt.getTime() - a.fetchedAt.getTime())[0];
  const lastResult = finished.at(-1)?.kickoffAt ?? null;

  return {
    competition,
    standings,
    upcoming,
    overdue,
    lastResult,
    source: latest ? ref(latest.sourceId, latest.fetchedAt, latest.sourceUrl) : null,
  };
}

/** Letztes Spiel mit Ergebnis je Wettbewerb – für die Startseite. */
export async function latestResultDates() {
  const rows = await getDb()
    .select({ code: competitions.code, last: sql<Date>`max(${matches.kickoffAt})` })
    .from(matches)
    .innerJoin(competitions, eq(competitions.id, matches.competitionId))
    .where(and(isNotNull(matches.homeScore), isNotNull(matches.awayScore), eq(matches.season, CURRENT_SEASON.label)))
    .groupBy(competitions.code)
    .orderBy(desc(competitions.code));
  return new Map(rows.map((r) => [r.code, new Date(r.last)]));
}
