import "server-only";
import { and, eq, gte, inArray } from "drizzle-orm";
import { FORM_WINDOW } from "@/config/form";
import { getDb } from "@/db";
import { competitions, matches, playerMatchStats, players } from "@/db/schema";
import { computeForm, type FormResult, type PerformanceRow, type PositionGroup } from "@/lib/form";

const columns = {
  playerId: playerMatchStats.playerId,
  matchId: matches.id,
  kickoffAt: matches.kickoffAt,
  competitionCode: competitions.code,
  season: matches.season,
  position: players.position,
  minutes: playerMatchStats.minutes,
  goals: playerMatchStats.goals,
  assists: playerMatchStats.assists,
  xg: playerMatchStats.xg,
  xa: playerMatchStats.xa,
  shotsOnTarget: playerMatchStats.shotsOnTarget,
  keyPasses: playerMatchStats.keyPasses,
  dribblesSuccessful: playerMatchStats.dribblesSuccessful,
  duelsWon: playerMatchStats.duelsWon,
  tackles: playerMatchStats.tackles,
  clearances: playerMatchStats.clearances,
  passes: playerMatchStats.passes,
  passesCompleted: playerMatchStats.passesCompleted,
  errorsLeadingToGoal: playerMatchStats.errorsLeadingToGoal,
  saves: playerMatchStats.saves,
  goalsConceded: playerMatchStats.goalsConceded,
  psxgFaced: playerMatchStats.psxgFaced,
};

type Row = PerformanceRow & { playerId: number };

function selectRows() {
  return getDb()
    .select(columns)
    .from(playerMatchStats)
    .innerJoin(matches, eq(matches.id, playerMatchStats.matchId))
    .innerJoin(competitions, eq(competitions.id, matches.competitionId))
    .innerJoin(players, eq(players.id, playerMatchStats.playerId));
}

const withPosition = (rows: Awaited<ReturnType<typeof selectRows>>): Row[] =>
  rows.filter((r): r is typeof r & { position: PositionGroup } => r.position !== null);

/**
 * Formbewertung für mehrere Spieler. Die Vergleichsverteilung (gleiche
 * Position, gleicher Wettbewerb, gleiche Saison) wird einmal geladen.
 */
export async function getForms(playerIds: number[], now: Date = new Date()): Promise<Map<number, FormResult>> {
  const result = new Map<number, FormResult>();
  if (playerIds.length === 0) return result;

  const own = withPosition(await selectRows().where(inArray(playerMatchStats.playerId, playerIds)));
  const competitionCodes = [...new Set(own.map((r) => r.competitionCode))];
  const seasons = [...new Set(own.map((r) => r.season))];
  const positions = [...new Set(own.map((r) => r.position))];
  if (own.length === 0) return result;

  const reference = withPosition(
    await selectRows().where(
      and(
        inArray(competitions.code, competitionCodes),
        inArray(matches.season, seasons),
        inArray(players.position, positions),
        gte(playerMatchStats.minutes, FORM_WINDOW.minMinutes),
      ),
    ),
  );

  const byPlayer = new Map<number, Row[]>();
  for (const r of own) byPlayer.set(r.playerId, [...(byPlayer.get(r.playerId) ?? []), r]);
  for (const [id, rows] of byPlayer) {
    const position = rows[0]!.position;
    result.set(
      id,
      computeForm(
        rows,
        reference.filter((r) => r.position === position),
        now,
      ),
    );
  }
  return result;
}

export async function getForm(playerId: number, now: Date = new Date()): Promise<FormResult | null> {
  return (await getForms([playerId], now)).get(playerId) ?? null;
}
