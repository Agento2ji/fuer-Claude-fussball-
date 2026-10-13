/**
 * Integrationstest gegen eine echte Datenbank (lokal oder in CI).
 * Wird übersprungen, wenn keine DATABASE_URL gesetzt ist.
 * Alles läuft in einer Transaktion, die am Ende zurückgerollt wird.
 */
import { config } from "dotenv";
import postgres from "postgres";
import { afterAll, describe, expect, it } from "vitest";

config({ path: ".env.local", quiet: true });

const url = process.env.DATABASE_URL;
const sql = url ? postgres(url, { max: 1, onnotice: () => {} }) : undefined;

class Rollback extends Error {}

afterAll(async () => {
  await sql?.end();
});

describe.skipIf(!sql)("odds_snapshots", () => {
  it("lässt Einfügen zu, verweigert aber UPDATE und DELETE", async () => {
    const db = sql!;
    await db
      .begin(async (tx) => {
        const [source] = await tx`
          insert into data_sources (key, name, kind, base_url, priority, status, license_note)
          values ('test-src', 'Test', 'api', 'https://example.invalid', 99, 'geplant', 'Test')
          returning id`;
        const [comp] = await tx`
          insert into competitions (code, name, country, type)
          values ('TEST', 'Test', 'DE', 'league') returning id`;
        const [home, away] = await tx`
          insert into teams (name, source_id, fetched_at)
          values ('Heim', ${source.id}, now()), ('Gast', ${source.id}, now())
          returning id`;
        const [match] = await tx`
          insert into matches (competition_id, season, home_team_id, away_team_id, kickoff_at, source_id, fetched_at)
          values (${comp.id}, '2026/27', ${home.id}, ${away.id}, now(), ${source.id}, now())
          returning id`;
        const [bm] = await tx`
          insert into bookmakers (key, name, show_in_comparison, use_for_fair_price)
          values ('test-bm', 'Test', false, false) returning id`;
        const [snap] = await tx`
          insert into odds_snapshots (match_id, bookmaker_id, market, selection, price, source_id, fetched_at)
          values (${match.id}, ${bm.id}, 'h2h', 'home', 2.1, ${source.id}, now())
          returning id`;

        await tx`savepoint vor_update`;
        await expect(
          tx`update odds_snapshots set price = 2.2 where id = ${snap.id}`,
        ).rejects.toThrow(/append-only/);
        await tx`rollback to savepoint vor_update`;

        await expect(
          tx`delete from odds_snapshots where id = ${snap.id}`,
        ).rejects.toThrow(/append-only/);

        throw new Rollback();
      })
      .catch((err) => {
        if (!(err instanceof Rollback)) throw err;
      });
  });
});
