/**
 * Integrationstest der Schreib-Schicht gegen eine echte Datenbank.
 * Läuft in einer Transaktion, die am Ende zurückgerollt wird.
 */
import { config } from "dotenv";
import { eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { createDb } from "@/db/client";
import { bookmakers, competitions, dataConflicts, dataSources, matches, oddsSnapshots } from "@/db/schema";
import { type DbLike, loadMappings, loadSources } from "@/ingestion/store/common";
import { writeMatches } from "@/ingestion/store/matches";
import { writeOdds } from "@/ingestion/store/odds";
import type { MatchRecord, OddsRecord, Sourced } from "@/ingestion/types";

config({ path: ".env.local", quiet: true });

const url = process.env.DATABASE_URL;
const conn = url ? createDb(url, 1) : undefined;

afterAll(async () => {
  await conn?.client.end();
});

class Rollback extends Error {}

async function inRollback(fn: (tx: DbLike) => Promise<void>) {
  await conn!.db
    .transaction(async (tx) => {
      await fn(tx);
      throw new Rollback();
    })
    .catch((err) => {
      if (!(err instanceof Rollback)) throw err;
    });
}

const fetchedAt = new Date("2026-10-13T12:00:00Z");

function match(
  source: string,
  externalId: string,
  home: [string, string],
  away: [string, string],
  kickoff: string,
  score: [number, number] | null,
): Sourced<MatchRecord> {
  return {
    externalId,
    competitionCode: "ZZT",
    season: "2026/27",
    matchday: 1,
    stage: null,
    homeTeam: { externalId: home[0], name: home[1] },
    awayTeam: { externalId: away[0], name: away[1] },
    kickoffAt: new Date(kickoff),
    kickoffTimeKnown: true,
    status: score ? "finished" : "scheduled",
    homeScore: score?.[0] ?? null,
    awayScore: score?.[1] ?? null,
    provenance: { source, fetchedAt, sourceUrl: null },
  };
}

async function setup(tx: DbLike) {
  await tx.insert(dataSources).values([
    { key: "zz-hoch", name: "Hoch", kind: "api", baseUrl: "x", priority: 1, status: "aktiv", licenseNote: "Test" },
    { key: "zz-niedrig", name: "Niedrig", kind: "open_data", baseUrl: "x", priority: 50, status: "aktiv", licenseNote: "Test" },
  ]);
  await tx.insert(competitions).values({ code: "ZZT", name: "Test", country: "DE", type: "league" });
  return loadSources(tx);
}

describe.skipIf(!conn)("writeMatches", () => {
  it("ist idempotent", async () => {
    await inRollback(async (tx) => {
      const sources = await setup(tx);
      const recs = [match("zz-niedrig", "m1", ["a", "Heimverein"], ["b", "Gastverein"], "2026-09-20T13:30:00Z", [2, 1])];
      const first = await writeMatches(tx, sources, recs, fetchedAt);
      const second = await writeMatches(tx, sources, recs, fetchedAt);
      expect(first.inserted).toBe(1);
      expect(second).toMatchObject({ inserted: 0, updated: 0, unchanged: 1 });
    });
  });

  it("legt verschiedene Teams derselben Quelle nie zusammen (Milan/Inter)", async () => {
    await inRollback(async (tx) => {
      const sources = await setup(tx);
      await writeMatches(tx, sources, [
        match("zz-niedrig", "m1", ["inter", "FC Internazionale Milano"], ["juve", "Juventus"], "2026-09-20T13:30:00Z", null),
        match("zz-niedrig", "m2", ["milan", "AC Milan"], ["roma", "AS Roma"], "2026-09-20T16:30:00Z", null),
        match("zz-niedrig", "m3", ["milan", "AC Milan"], ["inter", "FC Internazionale Milano"], "2026-10-20T16:30:00Z", null),
      ], fetchedAt);
      const ids = (await loadMappings(tx, sources.get("zz-niedrig")!.id, "team"));
      expect(new Set(ids.values()).size).toBe(4);
      expect(ids.get("inter")).not.toBe(ids.get("milan"));
    });
  });

  it("lässt die höher priorisierte Quelle gewinnen und loggt den Konflikt", async () => {
    await inRollback(async (tx) => {
      const sources = await setup(tx);
      await writeMatches(tx, sources, [
        match("zz-niedrig", "nied-1", ["a", "FC Bayern München"], ["b", "Borussia Dortmund"], "2026-09-20T13:30:00Z", [2, 2]),
      ], fetchedAt);
      const res = await writeMatches(tx, sources, [
        match("zz-hoch", "hoch-77", ["5", "Bayern Munich"], ["4", "Dortmund"], "2026-09-20T13:30:00Z", [3, 2]),
      ], fetchedAt);
      expect(res).toMatchObject({ inserted: 0, updated: 1, conflicts: 1 });

      const rows = await tx.select().from(matches).innerJoin(competitions, eq(competitions.id, matches.competitionId)).where(eq(competitions.code, "ZZT"));
      expect(rows).toHaveLength(1);
      expect(rows[0]!.matches.homeScore).toBe(3);

      // Die niedrigere Quelle überschreibt danach nicht mehr.
      const again = await writeMatches(tx, sources, [
        match("zz-niedrig", "nied-1", ["a", "FC Bayern München"], ["b", "Borussia Dortmund"], "2026-09-20T13:30:00Z", [2, 2]),
      ], fetchedAt);
      expect(again).toMatchObject({ updated: 0, unchanged: 1 });
      const [after] = await tx.select().from(matches).where(eq(matches.id, rows[0]!.matches.id));
      expect(after!.homeScore).toBe(3);

      const conflicts = await tx.select().from(dataConflicts).where(eq(dataConflicts.entityId, rows[0]!.matches.id));
      expect(conflicts).toHaveLength(1);
      expect(conflicts[0]).toMatchObject({ field: "score", keptValue: "3:2", otherValue: "2:2", unconfirmed: true });
    });
  });

  it("verwirft unplausible Ergebnisse mit Hinweis", async () => {
    await inRollback(async (tx) => {
      const sources = await setup(tx);
      const res = await writeMatches(tx, sources, [
        match("zz-niedrig", "m1", ["a", "A-Stadt"], ["b", "B-Dorf"], "2026-09-20T13:30:00Z", [99, 0]),
      ], fetchedAt);
      expect(res.inserted).toBe(0);
      expect(res.warnings[0]).toMatch(/Unplausibles Ergebnis/);
    });
  });
});

describe.skipIf(!conn)("writeOdds", () => {
  it("ordnet Quoten über Teamnamen zu und hängt Snapshots an", async () => {
    await inRollback(async (tx) => {
      const sources = await setup(tx);
      await tx.insert(bookmakers).values({ key: "zz-buchi", name: "Testbuch", showInComparison: true, useForFairPrice: true }).onConflictDoNothing();
      await writeMatches(tx, sources, [
        match("zz-niedrig", "m1", ["a", "FC Bayern München"], ["b", "Borussia Dortmund"], "2026-10-17T13:30:00Z", null),
      ], fetchedAt);
      const odds = (selection: string, price: number): Sourced<OddsRecord> => ({
        match: { externalId: "ev1", homeTeamName: "Bayern Munich", awayTeamName: "Borussia Dortmund", kickoffAt: new Date("2026-10-17T13:30:00Z") },
        bookmakerKey: "zz-buchi",
        market: "h2h",
        selection,
        line: null,
        price,
        bookmakerUpdatedAt: null,
        provenance: { source: "zz-hoch", fetchedAt, sourceUrl: null },
      });
      const unknown: Sourced<OddsRecord> = { ...odds("home", 2), match: { externalId: "ev2", homeTeamName: "Niemand", awayTeamName: "Keiner", kickoffAt: new Date("2026-10-17T13:30:00Z") } };

      const r1 = await writeOdds(tx, sources, "ZZT", [odds("home", 1.6), odds("draw", 4.2), odds("away", 4.8), unknown]);
      const r2 = await writeOdds(tx, sources, "ZZT", [odds("home", 1.65)]);
      expect(r1.inserted).toBe(3);
      expect(r1.unmatchedEvents).toHaveLength(1);
      expect(r2.inserted).toBe(1);
      const snaps = await tx.select().from(oddsSnapshots).innerJoin(bookmakers, eq(bookmakers.id, oddsSnapshots.bookmakerId)).where(eq(bookmakers.key, "zz-buchi"));
      expect(snaps).toHaveLength(4);
    });
  });
});
