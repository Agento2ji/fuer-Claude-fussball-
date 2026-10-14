import { and, eq, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { competitions, matches, teams } from "@/db/schema";
import { findTeam } from "../team-names";
import type { MatchRecord, Sourced, TeamRecord } from "../types";
import {
  type DbLike,
  type SourceInfo,
  chunks,
  dedupeBy,
  excludedSet,
  linkMany,
  loadMappings,
  logConflict,
  requireSource,
} from "./common";

export interface WriteMatchesResult {
  inserted: number;
  updated: number;
  unchanged: number;
  conflicts: number;
  /** Teams, die keinem vorhandenen zugeordnet werden konnten und neu angelegt wurden. */
  newTeams: string[];
  /** Lesbare Beschreibung der neuen Konflikte, z. B. für die Ausgabe des Abrufs. */
  conflictDetails: string[];
  /** Plausibilitätsbefunde, z. B. fehlende Ergebnisse. */
  warnings: string[];
}

const MAX_GOALS = 30;
/** Ab hier gilt ein Spiel ohne Ergebnis als „Ergebnis fehlt“. */
const RESULT_OVERDUE_MS = 36 * 60 * 60 * 1000;
/** Abweichung der Anstoßzeit, ab der ein Konflikt protokolliert wird. */
const KICKOFF_TOLERANCE_MS = 15 * 60 * 1000;
/** Ab dieser Abweichung wird die Anstoßzeit als „ungesichert“ markiert. */
const KICKOFF_UNCONFIRMED_MS = 2 * 60 * 60 * 1000;
/** Zeitfenster, in dem dieselbe Paarung als dasselbe Spiel gilt. */
const SAME_MATCH_WINDOW_MS = 4 * 24 * 60 * 60 * 1000;

const scoreText = (h: number | null, a: number | null) =>
  h === null || a === null ? null : `${h}:${a}`;

/**
 * Schreibt Spiele einer Quelle in die Datenbank. Idempotent.
 *
 * Zuordnung: erst über `external_ids`, dann über Wettbewerb + Saison +
 * Heim/Gast + Anstoß (±4 Tage). Bei bestehenden Spielen gewinnt die Quelle
 * mit der höheren Priorität; abweichende Werte werden als Konflikt geloggt.
 *
 * Entschieden wird im Speicher, geschrieben gebündelt: Gegen eine entfernte
 * Datenbank kostet jede Abfrage eine Netzwerk-Rundreise.
 */
export async function writeMatches(
  db: DbLike,
  sources: Map<string, SourceInfo>,
  records: Sourced<MatchRecord>[],
  now: Date = new Date(),
): Promise<WriteMatchesResult> {
  const result: WriteMatchesResult = {
    inserted: 0,
    updated: 0,
    unchanged: 0,
    conflicts: 0,
    newTeams: [],
    conflictDetails: [],
    warnings: [],
  };
  if (records.length === 0) return result;

  const sourceKey = records[0]!.provenance.source;
  const source = requireSource(sources, sourceKey);
  const sourceById = new Map([...sources.values()].map((s) => [s.id, s]));
  const { competitionCode, season } = records[0]!;

  const [competition] = await db
    .select({ id: competitions.id })
    .from(competitions)
    .where(eq(competitions.code, competitionCode));
  if (!competition) {
    throw new Error(`Wettbewerb ${competitionCode} fehlt – erst \`npm run db:seed\` ausführen.`);
  }

  // Bestehende Spiele dieser Saison inklusive Teamnamen laden.
  const home = alias(teams, "home");
  const away = alias(teams, "away");
  const existing = await db
    .select({
      match: matches,
      homeName: home.name,
      awayName: away.name,
    })
    .from(matches)
    .innerJoin(home, eq(home.id, matches.homeTeamId))
    .innerJoin(away, eq(away.id, matches.awayTeamId))
    .where(and(eq(matches.competitionId, competition.id), eq(matches.season, season)));

  const matchById = new Map(existing.map((e) => [e.match.id, e.match]));
  const teamCandidates = new Map<number, { id: number; name: string }>();
  for (const e of existing) {
    teamCandidates.set(e.match.homeTeamId, { id: e.match.homeTeamId, name: e.homeName });
    teamCandidates.set(e.match.awayTeamId, { id: e.match.awayTeamId, name: e.awayName });
  }

  const teamMap = await loadMappings(db, source.id, "team");
  const matchMap = await loadMappings(db, source.id, "match");
  const teamLinks: { entityId: number; externalId: string }[] = [];
  const matchLinks: { entityId: number; externalId: string }[] = [];
  type MatchValues = typeof matches.$inferInsert & { homeTeamId: number; awayTeamId: number; kickoffAt: Date };
  const pending: { values: MatchValues; externalIds: string[] }[] = [];
  const updates: (MatchValues & { id: number })[] = [];
  const samePairing = (m: { homeTeamId: number; awayTeamId: number; kickoffAt: Date }, v: MatchValues) =>
    m.homeTeamId === v.homeTeamId &&
    m.awayTeamId === v.awayTeamId &&
    Math.abs(m.kickoffAt.getTime() - v.kickoffAt.getTime()) < SAME_MATCH_WINDOW_MS;

  const resolveTeam = async (team: TeamRecord, p: Sourced<MatchRecord>["provenance"]) => {
    const mapped = teamMap.get(team.externalId);
    if (mapped) return mapped;
    // Nur gegen Teams anderer Quellen abgleichen: Innerhalb einer Quelle ist
    // eine neue ID immer ein anderes Team (sonst würden z. B. „AC Milan“ und
    // „Internazionale Milano“ verschmelzen).
    const ownTeamIds = new Set(teamMap.values());
    const found = findTeam(
      team.name,
      [...teamCandidates.values()].filter((c) => !ownTeamIds.has(c.id)),
    );
    let id = found?.id;
    if (!id) {
      const [row] = await db
        .insert(teams)
        .values({
          name: team.name,
          shortName: team.shortName ?? null,
          country: team.country ?? null,
          crestUrl: null,
          sourceId: source.id,
          fetchedAt: p.fetchedAt,
          sourceUrl: p.sourceUrl,
        })
        .returning({ id: teams.id });
      id = row!.id;
      teamCandidates.set(id, { id, name: team.name });
      result.newTeams.push(team.name);
    }
    teamLinks.push({ entityId: id, externalId: team.externalId });
    teamMap.set(team.externalId, id);
    return id;
  };

  let overdue = 0;
  for (const r of records) {
    if (
      (r.homeScore !== null && (r.homeScore < 0 || r.homeScore > MAX_GOALS)) ||
      (r.awayScore !== null && (r.awayScore < 0 || r.awayScore > MAX_GOALS))
    ) {
      result.warnings.push(`Unplausibles Ergebnis verworfen: ${r.homeTeam.name} – ${r.awayTeam.name} ${r.homeScore}:${r.awayScore}`);
      continue;
    }
    if (
      r.homeScore === null &&
      r.status === "scheduled" &&
      now.getTime() - r.kickoffAt.getTime() > RESULT_OVERDUE_MS
    ) {
      overdue++;
    }

    const homeTeamId = await resolveTeam(r.homeTeam, r.provenance);
    const awayTeamId = await resolveTeam(r.awayTeam, r.provenance);
    const values: MatchValues = {
      competitionId: competition.id,
      season: r.season,
      matchday: r.matchday,
      stage: r.stage,
      homeTeamId,
      awayTeamId,
      kickoffAt: r.kickoffAt,
      kickoffTimeKnown: r.kickoffTimeKnown,
      status: r.status,
      homeScore: r.homeScore,
      awayScore: r.awayScore,
      sourceId: source.id,
      fetchedAt: r.provenance.fetchedAt,
      sourceUrl: r.provenance.sourceUrl,
    };

    let current = matchById.get(matchMap.get(r.externalId) ?? -1);
    if (!current) {
      current = [...matchById.values()].find((m) => samePairing(m, values));
      if (current) {
        matchLinks.push({ entityId: current.id, externalId: r.externalId });
        matchMap.set(r.externalId, current.id);
      }
    }

    if (!current) {
      // Dasselbe Spiel kann im selben Abruf mehrfach vorkommen.
      const same = pending.find((p) => samePairing(p.values, values));
      if (same) {
        same.values = values;
        same.externalIds.push(r.externalId);
        result.unchanged++;
      } else {
        pending.push({ values, externalIds: [r.externalId] });
        result.inserted++;
      }
      continue;
    }

    const currentSource = sourceById.get(current.sourceId);
    const incomingWins =
      current.sourceId === source.id ||
      !currentSource ||
      source.priority <= currentSource.priority;

    // Konflikte nur zwischen verschiedenen Quellen und nur bei echten Werten.
    if (current.sourceId !== source.id) {
      const kept = incomingWins ? source.id : current.sourceId;
      const other = incomingWins ? current.sourceId : source.id;
      const curScore = scoreText(current.homeScore, current.awayScore);
      const newScore = scoreText(r.homeScore, r.awayScore);
      if (curScore && newScore && curScore !== newScore) {
        const logged = await logConflict(db, {
          entityType: "match",
          entityId: current.id,
          field: "score",
          keptSourceId: kept,
          keptValue: incomingWins ? newScore : curScore,
          otherSourceId: other,
          otherValue: incomingWins ? curScore : newScore,
          unconfirmed: true,
        });
        if (logged) {
          result.conflicts++;
          result.conflictDetails.push(`${r.homeTeam.name} – ${r.awayTeam.name}: Ergebnis ${newScore} statt ${curScore}`);
        }
      }
      const diff = Math.abs(current.kickoffAt.getTime() - r.kickoffAt.getTime());
      if (current.kickoffTimeKnown && r.kickoffTimeKnown && diff > KICKOFF_TOLERANCE_MS) {
        const logged = await logConflict(db, {
          entityType: "match",
          entityId: current.id,
          field: "kickoff_at",
          keptSourceId: kept,
          keptValue: (incomingWins ? r.kickoffAt : current.kickoffAt).toISOString(),
          otherSourceId: other,
          otherValue: (incomingWins ? current.kickoffAt : r.kickoffAt).toISOString(),
          unconfirmed: diff > KICKOFF_UNCONFIRMED_MS,
        });
        if (logged) {
          result.conflicts++;
          result.conflictDetails.push(
            `${r.homeTeam.name} – ${r.awayTeam.name}: Anstoß ${r.kickoffAt.toISOString()} statt ${current.kickoffAt.toISOString()}`,
          );
        }
      }
    }

    if (!incomingWins) {
      result.unchanged++;
      continue;
    }
    const changed =
      current.kickoffAt.getTime() !== r.kickoffAt.getTime() ||
      current.kickoffTimeKnown !== r.kickoffTimeKnown ||
      current.status !== r.status ||
      current.homeScore !== r.homeScore ||
      current.awayScore !== r.awayScore ||
      current.matchday !== r.matchday ||
      current.sourceId !== source.id;
    // fetched_at wird immer aktualisiert: Es belegt, wann die Quelle zuletzt bestätigt hat.
    updates.push({ id: current.id, ...values });
    matchById.set(current.id, { ...current, ...values });
    if (changed) result.updated++;
    else result.unchanged++;
  }

  for (const part of chunks(pending)) {
    const rows = await db
      .insert(matches)
      .values(part.map((p) => p.values))
      .returning({ id: matches.id, homeTeamId: matches.homeTeamId, awayTeamId: matches.awayTeamId, kickoffAt: matches.kickoffAt });
    part.forEach((p, i) => {
      const row = rows[i];
      // RETURNING liefert die Zeilen in Einfügereihenfolge; zur Sicherheit prüfen.
      if (!row || row.homeTeamId !== p.values.homeTeamId || row.awayTeamId !== p.values.awayTeamId || row.kickoffAt.getTime() !== p.values.kickoffAt.getTime()) {
        throw new Error("Zuordnung neuer Spiele fehlgeschlagen (RETURNING-Reihenfolge)");
      }
      for (const externalId of p.externalIds) matchLinks.push({ entityId: row.id, externalId });
    });
  }
  for (const part of chunks(dedupeBy(updates, (u) => String(u.id)))) {
    await db
      .insert(matches)
      .values(part)
      .onConflictDoUpdate({
        target: matches.id,
        set: { ...excludedSet(matches, Object.keys(part[0]!).filter((k) => k !== "id")), updatedAt: sql`now()` },
      });
  }
  await linkMany(db, source.id, "team", teamLinks);
  await linkMany(db, source.id, "match", matchLinks);

  if (overdue > 0) {
    result.warnings.push(
      `${overdue} Spiele in ${competitionCode} liegen über 36 Stunden zurück und haben bei ${sourceKey} noch kein Ergebnis.`,
    );
  }
  return result;
}
