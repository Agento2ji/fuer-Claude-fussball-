import { sql } from "drizzle-orm";
import { competitions } from "@/db/schema";
import { withFallback } from "../fallback";
import { TEST_COMPETITION, TestdatenProvider } from "../providers/testdaten";
import { matchProviders, oddsProviders } from "../registry";
import { type DbLike, loadSources } from "../store/common";
import { writeMatches } from "../store/matches";
import { writeOdds } from "../store/odds";
import {
  writeBroadcasts,
  writeContracts,
  writeInjuries,
  writePlayerMatchStats,
  writePlayers,
  writeSuspensions,
} from "../store/people";
import type { JobOutcome } from "./run-job";

/** Spielplan und Ergebnisse eines Wettbewerbs über die Fallback-Kette. */
export async function syncMatches(
  db: DbLike,
  competitionCode: string,
  now: Date = new Date(),
): Promise<JobOutcome> {
  const fb = await withFallback(
    matchProviders(),
    (p) => p.getMatches(competitionCode),
    (p) => p.supports(competitionCode),
  );
  if (!fb.result) {
    return {
      status: "skipped",
      itemsWritten: 0,
      details: { grund: "Kein Anbieter lieferte Daten", versuche: fb.attempts },
    };
  }
  const records = fb.result;
  const sources = await loadSources(db);
  const res = await db.transaction((tx) => writeMatches(tx, sources, records, now));
  return {
    status: "succeeded",
    itemsWritten: res.inserted + res.updated,
    details: { anbieter: fb.provider, versuche: fb.attempts, ...res },
  };
}

/** Quoten eines Wettbewerbs als neue Snapshots. */
export async function syncOdds(db: DbLike, competitionCode: string): Promise<JobOutcome> {
  const providers = oddsProviders();
  const fb = await withFallback(
    providers,
    (p) => p.getOdds(competitionCode),
    (p) => p.supports(competitionCode),
  );
  if (!fb.result) {
    return {
      status: "skipped",
      itemsWritten: 0,
      details: { grund: "Kein Quotenanbieter verfügbar (API-Key fehlt?)", versuche: fb.attempts },
    };
  }
  const records = fb.result;
  const sources = await loadSources(db);
  const res = await db.transaction((tx) => writeOdds(tx, sources, competitionCode, records));
  const quota = providers.find((p) => p.key === fb.provider);
  return {
    status: "succeeded",
    itemsWritten: res.inserted,
    details: {
      anbieter: fb.provider,
      nichtZugeordnet: res.unmatchedEvents,
      kontingent: quota && "lastQuota" in quota ? quota.lastQuota : undefined,
    },
  };
}

/**
 * Spielt die erfundene Testliga vollständig ein. Nur manuell aufrufen.
 * Bestehende Quoten-Snapshots der Testdaten bleiben erhalten (append-only).
 */
export async function syncTestdaten(db: DbLike, now: Date = new Date()): Promise<JobOutcome> {
  const provider = new TestdatenProvider(now);
  const sources = await loadSources(db);
  const today = now.toISOString().slice(0, 10);

  const counts = await db.transaction(async (tx) => {
    await tx
      .insert(competitions)
      .values({ ...TEST_COMPETITION, isTestData: true })
      .onConflictDoUpdate({
        target: competitions.code,
        set: { name: TEST_COMPETITION.name, isTestData: true, updatedAt: sql`now()` },
      });
    const code = TEST_COMPETITION.code;
    const m = await writeMatches(tx, sources, await provider.getMatches(), now);
    let players = 0;
    let contracts = 0;
    for (const team of provider.teams()) {
      players += await writePlayers(tx, sources, await provider.getSquad(team.externalId));
      contracts += await writeContracts(tx, sources, await provider.getContracts(team.externalId));
    }
    const stats = await writePlayerMatchStats(tx, sources, code, await provider.getPlayerMatchStats());
    const injuries = await writeInjuries(tx, sources, await provider.getInjuries(), today);
    const suspensions = await writeSuspensions(tx, sources, await provider.getSuspensions());
    const broadcasts = await writeBroadcasts(tx, sources, await provider.getBroadcasts());
    const odds = await writeOdds(tx, sources, code, await provider.getOdds());
    return {
      spiele: m.inserted + m.updated + m.unchanged,
      spieler: players,
      statistikZeilen: stats,
      verletzungen: injuries,
      sperren: suspensions,
      vertraege: contracts,
      uebertragungen: broadcasts,
      quotenSnapshots: odds.inserted,
    };
  });

  return {
    status: "succeeded",
    itemsWritten: Object.values(counts).reduce((a, b) => a + b, 0),
    details: counts,
  };
}
