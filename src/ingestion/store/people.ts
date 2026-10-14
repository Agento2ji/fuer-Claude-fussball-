/**
 * Schreiber für Spieler, Spielstatistik, Karten, Verletzungen, Sperren,
 * Verträge und Übertragungen. Alle idempotent (Upsert über Unique-Keys).
 * Spiele und Teams müssen vorher über `writeMatches` geschrieben sein.
 *
 * Geschrieben wird gebündelt (viele Zeilen je Statement), damit ein Abruf
 * gegen eine entfernte Datenbank nicht an der Netzwerklatenz scheitert.
 */
import { and, eq, inArray, isNull, notInArray, type SQL, sql } from "drizzle-orm";
import {
  broadcasts,
  cards,
  competitions,
  contracts,
  injuries,
  lineups,
  playerMatchStats,
  players,
  suspensions,
  teamMatchStats,
} from "@/db/schema";
import type {
  BroadcastRecord,
  ContractRecord,
  InjuryRecord,
  LineupRecord,
  PlayerMatchStatsRecord,
  PlayerRecord,
  Sourced,
  SuspensionRecord,
  TeamMatchStatsRecord,
} from "../types";
import {
  type DbLike,
  type SourceInfo,
  chunks,
  dedupeBy,
  excludedSet,
  linkMany,
  loadMappings,
  requireSource,
} from "./common";

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

/** Alle Spaltennamen, die in mindestens einer Zeile vorkommen. */
const keysOf = (rows: readonly object[]) => [...new Set(rows.flatMap((r) => Object.keys(r)))];

/** `(a, b) in ((1, 2), (3, 4))` für Löschungen über zusammengesetzte Schlüssel. */
const tupleIn = (columns: SQL, tuples: readonly (readonly (number | boolean)[])[]) =>
  sql`(${columns}) in (${sql.join(
    tuples.map((t) => sql`(${sql.join(t.map((v) => sql`${v}`), sql`, `)})`),
    sql`, `,
  )})`;

export async function writePlayers(
  db: DbLike,
  sources: Map<string, SourceInfo>,
  records: Sourced<PlayerRecord>[],
): Promise<number> {
  if (records.length === 0) return 0;
  const source = requireSource(sources, records[0]!.provenance.source);
  const teamMap = await loadMappings(db, source.id, "team");
  const playerMap = await loadMappings(db, source.id, "player");

  const prepared: { externalId: string; values: typeof players.$inferInsert }[] = [];
  for (const r of records) {
    const teamId = need(teamMap, r.teamExternalId, "Team");
    if (teamId === undefined) continue;
    prepared.push({
      externalId: r.externalId,
      values: {
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
      },
    });
  }
  if (prepared.length === 0) return 0;

  // Matching über Name + Geburtsdatum + Verein, nie über den Namen allein.
  const naturalKey = (v: { lastName?: string | null; birthDate?: string | null; currentTeamId?: number | null }) =>
    v.lastName && v.birthDate ? `${v.lastName}|${v.birthDate}|${v.currentTeamId}` : null;
  const unknown = prepared.filter((p) => !playerMap.has(p.externalId) && naturalKey(p.values));
  if (unknown.length) {
    const teamIds = [...new Set(unknown.map((p) => p.values.currentTeamId!))];
    const candidates = await db
      .select({ id: players.id, lastName: players.lastName, birthDate: players.birthDate, currentTeamId: players.currentTeamId })
      .from(players)
      .where(inArray(players.currentTeamId, teamIds))
      .orderBy(players.id);
    const byKey = new Map<string, number>();
    for (const c of candidates) {
      const key = naturalKey(c);
      if (key && !byKey.has(key)) byKey.set(key, c.id);
    }
    for (const p of unknown) {
      const id = byKey.get(naturalKey(p.values)!);
      if (id !== undefined) playerMap.set(p.externalId, id);
    }
  }

  // Bekannte Spieler aktualisieren: Upsert über die ID.
  const known = dedupeBy(
    prepared.filter((p) => playerMap.has(p.externalId)).map((p) => ({ id: playerMap.get(p.externalId)!, ...p.values })),
    (r) => String(r.id),
  );
  for (const part of chunks(known)) {
    await db
      .insert(players)
      .values(part)
      .onConflictDoUpdate({
        target: players.id,
        set: { ...excludedSet(players, keysOf(part).filter((k) => k !== "id")), updatedAt: sql`now()` },
      });
  }

  // Neue Spieler anlegen. Gleicher natürlicher Schlüssel → derselbe Spieler.
  const fresh: { externalIds: string[]; values: typeof players.$inferInsert }[] = [];
  const freshByKey = new Map<string, (typeof fresh)[number]>();
  for (const p of prepared) {
    if (playerMap.has(p.externalId)) continue;
    const key = naturalKey(p.values);
    const same = key ? freshByKey.get(key) : undefined;
    if (same) {
      same.externalIds.push(p.externalId);
      continue;
    }
    const entry = { externalIds: [p.externalId], values: p.values };
    fresh.push(entry);
    if (key) freshByKey.set(key, entry);
  }
  for (const part of chunks(fresh)) {
    const rows = await db
      .insert(players)
      .values(part.map((f) => f.values))
      .returning({ id: players.id, name: players.name, currentTeamId: players.currentTeamId });
    part.forEach((f, i) => {
      const row = rows[i];
      // RETURNING liefert die Zeilen in Einfügereihenfolge; zur Sicherheit prüfen.
      if (!row || row.name !== f.values.name || row.currentTeamId !== f.values.currentTeamId) {
        throw new Error("Zuordnung neuer Spieler fehlgeschlagen (RETURNING-Reihenfolge)");
      }
      for (const ext of f.externalIds) playerMap.set(ext, row.id);
    });
  }

  await linkMany(
    db,
    source.id,
    "player",
    prepared.map((p) => ({ entityId: playerMap.get(p.externalId)!, externalId: p.externalId })),
  );
  return prepared.length;
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

  const statRows: (typeof playerMatchStats.$inferInsert)[] = [];
  const cardRows: (typeof cards.$inferInsert)[] = [];
  for (const r of records) {
    const playerId = need(playerMap, r.playerExternalId, "Spieler");
    const matchId = need(matchMap, r.matchExternalId, "Spiel");
    const teamId = need(teamMap, r.teamExternalId, "Team");
    if (playerId === undefined || matchId === undefined || teamId === undefined) continue;
    const { playerExternalId, matchExternalId, teamExternalId, provenance, ...stats } = r;
    statRows.push({ ...stats, playerId, matchId, teamId, ...provenanceValues(source.id, r) });
    // Karten zusätzlich einzeln, für Sperrenstand und Sperrgefahr.
    if (r.yellowCards) cardRows.push({ type: "yellow", playerId, matchId, competitionId: competition.id, minute: null, ...provenanceValues(source.id, r) });
    if (r.redCards) cardRows.push({ type: "red", playerId, matchId, competitionId: competition.id, minute: null, ...provenanceValues(source.id, r) });
  }
  const unique = dedupeBy(statRows, (r) => `${r.matchId}|${r.playerId}`);
  for (const part of chunks(unique)) {
    await db
      .insert(playerMatchStats)
      .values(part)
      .onConflictDoUpdate({
        target: [playerMatchStats.matchId, playerMatchStats.playerId],
        set: excludedSet(playerMatchStats, keysOf(part)),
      });
  }
  // Karten dieser Spiele aus dieser Quelle ersetzen, damit Korrekturen greifen.
  for (const part of chunks(unique)) {
    await db
      .delete(cards)
      .where(
        and(
          eq(cards.sourceId, source.id),
          tupleIn(sql`${cards.matchId}, ${cards.playerId}`, part.map((r) => [r.matchId, r.playerId])),
        ),
      );
  }
  for (const part of chunks(cardRows)) await db.insert(cards).values(part);
  return statRows.length;
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
  const rows: (typeof injuries.$inferInsert)[] = [];
  for (const r of records) {
    const playerId = need(playerMap, r.playerExternalId, "Spieler");
    if (playerId === undefined) continue;
    const { playerExternalId, provenance, ...rest } = r;
    rows.push({ ...rest, playerId, endedAt: null, ...provenanceValues(source.id, r) });
  }
  const seen: number[] = [];
  for (const part of chunks(dedupeBy(rows, (r) => `${r.playerId}|${r.since}`))) {
    const written = await db
      .insert(injuries)
      .values(part)
      .onConflictDoUpdate({
        target: [injuries.playerId, injuries.sourceId, injuries.since],
        set: { ...excludedSet(injuries, keysOf(part)), updatedAt: sql`now()` },
      })
      .returning({ id: injuries.id });
    seen.push(...written.map((w) => w.id));
  }
  // Verletzungen dieser Quelle, die nicht mehr gemeldet werden, gelten als beendet.
  await db
    .update(injuries)
    .set({ endedAt: today })
    .where(and(eq(injuries.sourceId, source.id), isNull(injuries.endedAt), notInArray(injuries.id, seen)));
  return seen.length;
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
  const rows: (typeof suspensions.$inferInsert)[] = [];
  for (const r of records) {
    const playerId = need(playerMap, r.playerExternalId, "Spieler");
    if (playerId === undefined) continue;
    rows.push({
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
    });
  }
  const seen: number[] = [];
  for (const part of chunks(dedupeBy(rows, (r) => `${r.playerId}|${r.reason}|${r.triggeredByMatchId}`))) {
    const written = await db
      .insert(suspensions)
      .values(part)
      .onConflictDoUpdate({
        target: [suspensions.playerId, suspensions.sourceId, suspensions.reason, suspensions.triggeredByMatchId],
        set: { ...excludedSet(suspensions, keysOf(part)), updatedAt: sql`now()` },
      })
      .returning({ id: suspensions.id });
    seen.push(...written.map((w) => w.id));
  }
  await db
    .update(suspensions)
    .set({ active: false })
    .where(and(eq(suspensions.sourceId, source.id), eq(suspensions.active, true), notInArray(suspensions.id, seen)));
  return seen.length;
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
  const rows: (typeof contracts.$inferInsert)[] = [];
  for (const r of records) {
    const playerId = need(playerMap, r.playerExternalId, "Spieler");
    const teamId = need(teamMap, r.teamExternalId, "Team");
    if (playerId === undefined || teamId === undefined) continue;
    const { playerExternalId, teamExternalId, provenance, ...rest } = r;
    rows.push({ ...rest, playerId, teamId, ...provenanceValues(source.id, r) });
  }
  for (const part of chunks(dedupeBy(rows, (r) => `${r.playerId}|${r.teamId}`))) {
    await db
      .insert(contracts)
      .values(part)
      .onConflictDoUpdate({
        target: [contracts.playerId, contracts.teamId, contracts.sourceId],
        set: { ...excludedSet(contracts, keysOf(part)), updatedAt: sql`now()` },
      });
  }
  return rows.length;
}

export async function writeBroadcasts(
  db: DbLike,
  sources: Map<string, SourceInfo>,
  records: Sourced<BroadcastRecord>[],
): Promise<number> {
  if (records.length === 0) return 0;
  const source = requireSource(sources, records[0]!.provenance.source);
  const matchMap = await loadMappings(db, source.id, "match");
  const rows: (typeof broadcasts.$inferInsert)[] = [];
  for (const r of records) {
    const matchId = need(matchMap, r.matchExternalId, "Spiel");
    if (matchId === undefined) continue;
    const { matchExternalId, provenance, ...rest } = r;
    rows.push({ ...rest, matchId, ...provenanceValues(source.id, r) });
  }
  for (const part of chunks(dedupeBy(rows, (r) => `${r.matchId}|${r.country}|${r.broadcaster}`))) {
    await db
      .insert(broadcasts)
      .values(part)
      .onConflictDoUpdate({
        target: [broadcasts.matchId, broadcasts.country, broadcasts.broadcaster],
        set: excludedSet(broadcasts, keysOf(part)),
      });
  }
  return rows.length;
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
  const rows: (typeof teamMatchStats.$inferInsert)[] = [];
  for (const r of records) {
    const matchId = need(matchMap, r.matchExternalId, "Spiel");
    const teamId = need(teamMap, r.teamExternalId, "Team");
    if (matchId === undefined || teamId === undefined) continue;
    const { matchExternalId, teamExternalId, provenance, ...rest } = r;
    rows.push({ ...rest, matchId, teamId, ...provenanceValues(source.id, r) });
  }
  for (const part of chunks(dedupeBy(rows, (r) => `${r.matchId}|${r.teamId}`))) {
    await db
      .insert(teamMatchStats)
      .values(part)
      .onConflictDoUpdate({
        target: [teamMatchStats.matchId, teamMatchStats.teamId],
        set: excludedSet(teamMatchStats, keysOf(part)),
      });
  }
  return rows.length;
}

/**
 * Aufstellungen je Spiel und Team ersetzen: Eine neue Meldung (z. B. die
 * bestätigte statt der voraussichtlichen) gilt vollständig, alte Einträge
 * derselben Quelle und Art fallen weg.
 */
export async function writeLineups(
  db: DbLike,
  sources: Map<string, SourceInfo>,
  records: Sourced<LineupRecord>[],
): Promise<number> {
  if (records.length === 0) return 0;
  const source = requireSource(sources, records[0]!.provenance.source);
  const matchMap = await loadMappings(db, source.id, "match");
  const teamMap = await loadMappings(db, source.id, "team");
  const playerMap = await loadMappings(db, source.id, "player");
  const rows: (typeof lineups.$inferInsert)[] = [];
  const groups = new Map<string, [number, number, boolean]>();
  for (const r of records) {
    const matchId = need(matchMap, r.matchExternalId, "Spiel");
    const teamId = need(teamMap, r.teamExternalId, "Team");
    const playerId = need(playerMap, r.playerExternalId, "Spieler");
    if (matchId === undefined || teamId === undefined || playerId === undefined) continue;
    groups.set(`${matchId}|${teamId}|${r.isProbable}`, [matchId, teamId, r.isProbable]);
    const { matchExternalId, teamExternalId, playerExternalId, provenance, ...rest } = r;
    rows.push({ ...rest, matchId, teamId, playerId, ...provenanceValues(source.id, r) });
  }
  for (const part of chunks([...groups.values()])) {
    await db
      .delete(lineups)
      .where(
        and(
          eq(lineups.sourceId, source.id),
          tupleIn(sql`${lineups.matchId}, ${lineups.teamId}, ${lineups.isProbable}`, part),
        ),
      );
  }
  for (const part of chunks(rows)) await db.insert(lineups).values(part);
  return rows.length;
}
