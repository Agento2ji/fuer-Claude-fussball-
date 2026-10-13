import "server-only";
import { and, asc, eq, inArray, isNull, sql } from "drizzle-orm";
import { CURRENT_SEASON } from "@/config/competitions";
import { getDb } from "@/db";
import { cards, competitions, injuries, matches, players, suspensions } from "@/db/schema";
import { yellowCardRisk } from "@/lib/player-status";
import { sourceResolver } from "./sources";

export type Availability = Awaited<ReturnType<typeof getAvailability>>;

/** Kader eines Teams mit Ausfällen (Verletzung, Sperre) und Sperrgefahr. */
export async function getAvailability(teamId: number) {
  const db = getDb();
  const ref = await sourceResolver();
  const squad = await db
    .select({ id: players.id, name: players.name, position: players.position, shirtNumber: players.shirtNumber })
    .from(players)
    .where(eq(players.currentTeamId, teamId))
    .orderBy(asc(players.shirtNumber));
  const squadIds = squad.map((p) => p.id);
  if (squadIds.length === 0) return { squad, absences: [], atRisk: [] };

  const [activeInjuries, activeSuspensions, yellow] = await Promise.all([
    db.select().from(injuries).where(and(inArray(injuries.playerId, squadIds), isNull(injuries.endedAt))),
    db
      .select({ s: suspensions, competitionName: competitions.name })
      .from(suspensions)
      .leftJoin(competitions, eq(competitions.id, suspensions.competitionId))
      .where(and(inArray(suspensions.playerId, squadIds), eq(suspensions.active, true))),
    db
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
      .groupBy(cards.playerId, competitions.name, competitions.yellowCardSuspensionThreshold),
  ]);

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

  return { squad, absences, atRisk };
}
