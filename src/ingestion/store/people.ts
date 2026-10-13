/**
 * Schreiber für Spieler, Spielstatistik, Karten, Verletzungen, Sperren,
 * Verträge und Übertragungen. Alle idempotent (Upsert über Unique-Keys).
 * Spiele und Teams müssen vorher über `writeMatches` geschrieben sein.
 */
import { and, eq, sql } from "drizzle-orm";
import {
  broadcasts,
  cards,
  competitions,
  contracts,
  injuries,
  playerMatchStats,
  players,
  suspensions,
  teamMatchStats,
} from "@/db/schema";
import type {
  BroadcastRecord,
  ContractRecord,
  InjuryRecord,
  PlayerMatchStatsRecord,
  PlayerRecord,
  Sourced,
  SuspensionRecord,
  TeamMatchStatsRecord,
} from "../types";
import { type DbLike, type SourceInfo, link, loadMappings, requireSource } from "./common";

const provenanceValues = (sourceId: number, r: Sourced<unknown>) => ({
  sourceId,
  fetchedAt: r.provenance.fetchedAt,
  sourceUrl: r.provenance.sourceUrl,
});

function need(map: Map<string, number>, ext: string, what: string): number | undefined {
  const id = map.get(ext);
  if (id === undefined) console.warn(`  ${what} ${ext} nicht zugeordnet – übersprungen`);
  return id;
}

export async function writePlayers(
  db: DbLike,
  sources: Map<string, SourceInfo>,
  records: Sourced<PlayerRecord>[],
): Promise<number> {
  if (records.length === 0) return 0;
  const source = requireSource(sources, records[0]!.provenance.source);
  const teamMap = await loadMappings(db, source.id, "team");
  const playerMap = await loadMappings(db, source.id, "player");
  let written = 0;
  for (const r of records) {
    const teamId = need(teamMap, r.teamExternalId, "Team");
    if (teamId === undefined) continue;
    const values = {
      name: r.name,
      firstName: r.firstName,
      lastName: r.lastName,
      birthDate: r.birthDate,
      nationality: r.nationality,
      position: r.position,
      detailedPosition: r.detailedPosition,
      currentTeamId: teamId,
      shirtNumber: r.shirtNumber,
      ...provenanceValues(source.id, r),
    };
    let id = playerMap.get(r.externalId);
    if (id === undefined && r.lastName && r.birthDate) {
      // Matching über Name + Geburtsdatum + Verein, nie über den Namen allein.
      const [hit] = await db
        .select({ id: players.id })
        .from(players)
        .where(
          and(
            eq(players.lastName, r.lastName),
            eq(players.birthDate, r.birthDate),
            eq(players.currentTeamId, teamId),
          ),
        );
      id = hit?.id;
    }
    if (id === undefined) {
      const [row] = await db.insert(players).values(values).returning({ id: players.id });
      id = row!.id;
    } else {
      await db.update(players).set(values).where(eq(players.id, id));
    }
    await link(db, source.id, "player", id, r.externalId);
    playerMap.set(r.externalId, id);
    written++;
  }
  return written;
}

export async function writePlayerMatchStats(
  db: DbLike,
  sources: Map<string, SourceInfo>,
  competitionCode: string,
  records: Sourced<PlayerMatchStatsRecord>[],
): Promise<number> {
  if (records.length === 0) return 0;
  const source = requireSource(sources, records[0]!.provenance.source);
  const [competition] = await db
    .select({ id: competitions.id })
    .from(competitions)
    .where(eq(competitions.code, competitionCode));
  if (!competition) throw new Error(`Wettbewerb ${competitionCode} fehlt`);
  const playerMap = await loadMappings(db, source.id, "player");
  const matchMap = await loadMappings(db, source.id, "match");
  const teamMap = await loadMappings(db, source.id, "team");
  let written = 0;
  for (const r of records) {
    const playerId = need(playerMap, r.playerExternalId, "Spieler");
    const matchId = need(matchMap, r.matchExternalId, "Spiel");
    const teamId = need(teamMap, r.teamExternalId, "Team");
    if (playerId === undefined || matchId === undefined || teamId === undefined) continue;
    const { playerExternalId, matchExternalId, teamExternalId, provenance, ...stats } = r;
    const values = { ...stats, playerId, matchId, teamId, ...provenanceValues(source.id, r) };
    await db
      .insert(playerMatchStats)
      .values(values)
      .onConflictDoUpdate({
        target: [playerMatchStats.matchId, playerMatchStats.playerId],
        set: values,
      });
    // Karten zusätzlich einzeln, für Sperrenstand und Sperrgefahr.
    const cardRows: (typeof cards.$inferInsert)[] = [];
    if (r.yellowCards) cardRows.push({ type: "yellow", playerId, matchId, competitionId: competition.id, minute: null, ...provenanceValues(source.id, r) });
    if (r.redCards) cardRows.push({ type: "red", playerId, matchId, competitionId: competition.id, minute: null, ...provenanceValues(source.id, r) });
    // Karten dieses Spiels aus dieser Quelle ersetzen, damit Korrekturen greifen.
    await db
      .delete(cards)
      .where(and(eq(cards.matchId, matchId), eq(cards.playerId, playerId), eq(cards.sourceId, source.id)));
    if (cardRows.length) await db.insert(cards).values(cardRows);
    written++;
  }
  return written;
}

export async function writeInjuries(
  db: DbLike,
  sources: Map<string, SourceInfo>,
  records: Sourced<InjuryRecord>[],
  today: string,
): Promise<number> {
  if (records.length === 0) return 0;
  const source = requireSource(sources, records[0]!.provenance.source);
  const playerMap = await loadMappings(db, source.id, "player");
  const seen = new Set<number>();
  for (const r of records) {
    const playerId = need(playerMap, r.playerExternalId, "Spieler");
    if (playerId === undefined) continue;
    const { playerExternalId, provenance, ...rest } = r;
    const values = { ...rest, playerId, endedAt: null, ...provenanceValues(source.id, r) };
    const [row] = await db
      .insert(injuries)
      .values(values)
      .onConflictDoUpdate({
        target: [injuries.playerId, injuries.sourceId, injuries.since],
        set: { ...values, updatedAt: sql`now()` },
      })
      .returning({ id: injuries.id });
    seen.add(row!.id);
  }
  // Verletzungen dieser Quelle, die nicht mehr gemeldet werden, gelten als beendet.
  const open = await db
    .select({ id: injuries.id })
    .from(injuries)
    .where(and(eq(injuries.sourceId, source.id), sql`${injuries.endedAt} is null`));
  for (const o of open) {
    if (!seen.has(o.id)) {
      await db.update(injuries).set({ endedAt: today }).where(eq(injuries.id, o.id));
    }
  }
  return seen.size;
}

export async function writeSuspensions(
  db: DbLike,
  sources: Map<string, SourceInfo>,
  records: Sourced<SuspensionRecord>[],
): Promise<number> {
  if (records.length === 0) return 0;
  const source = requireSource(sources, records[0]!.provenance.source);
  const playerMap = await loadMappings(db, source.id, "player");
  const matchMap = await loadMappings(db, source.id, "match");
  const competitionIds = new Map(
    (await db.select({ id: competitions.id, code: competitions.code }).from(competitions)).map(
      (c) => [c.code, c.id],
    ),
  );
  const seen = new Set<number>();
  for (const r of records) {
    const playerId = need(playerMap, r.playerExternalId, "Spieler");
    if (playerId === undefined) continue;
    const values = {
      playerId,
      reason: r.reason,
      competitionId: r.competitionCode ? (competitionIds.get(r.competitionCode) ?? null) : null,
      matchesCount: r.matchesCount,
      triggeredByMatchId: r.triggeredByMatchExternalId
        ? (matchMap.get(r.triggeredByMatchExternalId) ?? null)
        : null,
      firstEligibleMatchId: null,
      active: true,
      ...provenanceValues(source.id, r),
    };
    const [row] = await db
      .insert(suspensions)
      .values(values)
      .onConflictDoUpdate({
        target: [suspensions.playerId, suspensions.sourceId, suspensions.reason, suspensions.triggeredByMatchId],
        set: { ...values, updatedAt: sql`now()` },
      })
      .returning({ id: suspensions.id });
    seen.add(row!.id);
  }
  const active = await db
    .select({ id: suspensions.id })
    .from(suspensions)
    .where(and(eq(suspensions.sourceId, source.id), eq(suspensions.active, true)));
  for (const a of active) {
    if (!seen.has(a.id)) {
      await db.update(suspensions).set({ active: false }).where(eq(suspensions.id, a.id));
    }
  }
  return seen.size;
}

export async function writeContracts(
  db: DbLike,
  sources: Map<string, SourceInfo>,
  records: Sourced<ContractRecord>[],
): Promise<number> {
  if (records.length === 0) return 0;
  const source = requireSource(sources, records[0]!.provenance.source);
  const playerMap = await loadMappings(db, source.id, "player");
  const teamMap = await loadMappings(db, source.id, "team");
  let written = 0;
  for (const r of records) {
    const playerId = need(playerMap, r.playerExternalId, "Spieler");
    const teamId = need(teamMap, r.teamExternalId, "Team");
    if (playerId === undefined || teamId === undefined) continue;
    const { playerExternalId, teamExternalId, provenance, ...rest } = r;
    const values = { ...rest, playerId, teamId, ...provenanceValues(source.id, r) };
    await db
      .insert(contracts)
      .values(values)
      .onConflictDoUpdate({
        target: [contracts.playerId, contracts.teamId, contracts.sourceId],
        set: { ...values, updatedAt: sql`now()` },
      });
    written++;
  }
  return written;
}

export async function writeBroadcasts(
  db: DbLike,
  sources: Map<string, SourceInfo>,
  records: Sourced<BroadcastRecord>[],
): Promise<number> {
  if (records.length === 0) return 0;
  const source = requireSource(sources, records[0]!.provenance.source);
  const matchMap = await loadMappings(db, source.id, "match");
  let written = 0;
  for (const r of records) {
    const matchId = need(matchMap, r.matchExternalId, "Spiel");
    if (matchId === undefined) continue;
    const { matchExternalId, provenance, ...rest } = r;
    const values = { ...rest, matchId, ...provenanceValues(source.id, r) };
    await db
      .insert(broadcasts)
      .values(values)
      .onConflictDoUpdate({
        target: [broadcasts.matchId, broadcasts.country, broadcasts.broadcaster],
        set: values,
      });
    written++;
  }
  return written;
}

export async function writeTeamMatchStats(
  db: DbLike,
  sources: Map<string, SourceInfo>,
  records: Sourced<TeamMatchStatsRecord>[],
): Promise<number> {
  if (records.length === 0) return 0;
  const source = requireSource(sources, records[0]!.provenance.source);
  const matchMap = await loadMappings(db, source.id, "match");
  const teamMap = await loadMappings(db, source.id, "team");
  let written = 0;
  for (const r of records) {
    const matchId = need(matchMap, r.matchExternalId, "Spiel");
    const teamId = need(teamMap, r.teamExternalId, "Team");
    if (matchId === undefined || teamId === undefined) continue;
    const { matchExternalId, teamExternalId, provenance, ...rest } = r;
    const values = { ...rest, matchId, teamId, ...provenanceValues(source.id, r) };
    await db
      .insert(teamMatchStats)
      .values(values)
      .onConflictDoUpdate({ target: [teamMatchStats.matchId, teamMatchStats.teamId], set: values });
    written++;
  }
  return written;
}
