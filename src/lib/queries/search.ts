import "server-only";
import { and, asc, desc, eq, gt, lte, or, sql, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import { CURRENT_SEASON } from "@/config/competitions";
import { getDb } from "@/db";
import { competitions, matches, players, teams } from "@/db/schema";

/** Umlaute und Akzente vereinheitlichen, damit „munchen“ „München“ findet. */
const FROM = "äöüßéèêáàâíìîóòôúùûñçÄÖÜÉÈÁÀÍÓÚÑÇ";
const TO = "aousee" + "eaaaiiiooouuunc" + "aoueeaaiounc";

export function normalizeQuery(q: string): string {
  let out = q.toLowerCase();
  for (let i = 0; i < FROM.length; i++) out = out.split(FROM[i]!).join(TO[i] ?? "");
  return out.trim();
}

const matchesText = (column: AnyPgColumn, q: string): SQL =>
  sql`translate(lower(${column}), ${FROM.toLowerCase()}, ${TO}) like ${"%" + q + "%"}`;

export interface SearchResult {
  players: { id: number; name: string; team: string | null }[];
  teams: { id: number; name: string }[];
  matches: { id: number; label: string; kickoffAt: Date; competition: string }[];
}

export async function search(raw: string, now: Date = new Date()): Promise<SearchResult> {
  const q = normalizeQuery(raw).replace(/[%_\\]/g, "");
  if (q.length < 2) return { players: [], teams: [], matches: [] };
  const db = getDb();
  const home = alias(teams, "home");
  const away = alias(teams, "away");

  const [playerRows, teamRows, upcoming, recent] = await Promise.all([
    db
      .select({ id: players.id, name: players.name, team: teams.name })
      .from(players)
      .leftJoin(teams, eq(teams.id, players.currentTeamId))
      .where(matchesText(players.name, q))
      .orderBy(asc(players.name))
      .limit(6),
    db.select({ id: teams.id, name: teams.name }).from(teams).where(matchesText(teams.name, q)).orderBy(asc(teams.name)).limit(6),
    db
      .select({ id: matches.id, kickoffAt: matches.kickoffAt, home: home.name, away: away.name, competition: competitions.name })
      .from(matches)
      .innerJoin(home, eq(home.id, matches.homeTeamId))
      .innerJoin(away, eq(away.id, matches.awayTeamId))
      .innerJoin(competitions, eq(competitions.id, matches.competitionId))
      .where(and(eq(matches.season, CURRENT_SEASON.label), gt(matches.kickoffAt, now), or(matchesText(home.name, q), matchesText(away.name, q))))
      .orderBy(asc(matches.kickoffAt))
      .limit(3),
    db
      .select({ id: matches.id, kickoffAt: matches.kickoffAt, home: home.name, away: away.name, competition: competitions.name })
      .from(matches)
      .innerJoin(home, eq(home.id, matches.homeTeamId))
      .innerJoin(away, eq(away.id, matches.awayTeamId))
      .innerJoin(competitions, eq(competitions.id, matches.competitionId))
      .where(and(eq(matches.season, CURRENT_SEASON.label), lte(matches.kickoffAt, now), or(matchesText(home.name, q), matchesText(away.name, q))))
      .orderBy(desc(matches.kickoffAt))
      .limit(2),
  ]);

  return {
    players: playerRows,
    teams: teamRows,
    matches: [...upcoming, ...recent].map((m) => ({
      id: m.id,
      label: `${m.home} – ${m.away}`,
      kickoffAt: m.kickoffAt,
      competition: m.competition,
    })),
  };
}
