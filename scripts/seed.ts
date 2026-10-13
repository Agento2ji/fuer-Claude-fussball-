/**
 * Überträgt die Konfiguration (Quellen, Wettbewerbe, Buchmacher) in die
 * Datenbank. Idempotent: mehrfaches Ausführen aktualisiert nur.
 * Es werden hier keine Spiel- oder Spielerdaten angelegt.
 */
import { config } from "dotenv";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { BOOKMAKERS } from "../src/config/bookmakers";
import { COMPETITIONS } from "../src/config/competitions";
import { DATA_SOURCES } from "../src/config/data-sources";
import { bookmakers, competitions, dataSources } from "../src/db/schema";
import { parseServerEnv } from "../src/lib/env";

config({ path: ".env.local" });

async function main() {
  const env = parseServerEnv(process.env);
  const client = postgres(env.DATABASE_URL, { max: 1 });
  const db = drizzle(client);

  try {
    await db.transaction(async (tx) => {
      for (const s of DATA_SOURCES) {
        await tx
          .insert(dataSources)
          .values(s)
          .onConflictDoUpdate({
            target: dataSources.key,
            set: {
              name: s.name,
              kind: s.kind,
              baseUrl: s.baseUrl,
              priority: s.priority,
              status: s.status,
              licenseNote: s.licenseNote,
              updatedAt: sql`now()`,
            },
          });
      }

      for (const c of COMPETITIONS) {
        await tx
          .insert(competitions)
          .values({
            code: c.code,
            name: c.name,
            country: c.country,
            type: c.type,
            hasMatchPages: c.hasMatchPages,
            yellowCardSuspensionThreshold: c.yellowCardSuspensionThreshold,
          })
          .onConflictDoUpdate({
            target: competitions.code,
            set: {
              name: c.name,
              country: c.country,
              type: c.type,
              hasMatchPages: c.hasMatchPages,
              yellowCardSuspensionThreshold: c.yellowCardSuspensionThreshold,
              updatedAt: sql`now()`,
            },
          });
      }

      for (const b of BOOKMAKERS) {
        const values = {
          key: b.key,
          name: b.name,
          showInComparison: b.showInComparison,
          useForFairPrice: b.useForFairPrice,
          gglLicenseVerified: b.gglLicenseVerified,
        };
        await tx
          .insert(bookmakers)
          .values(values)
          .onConflictDoUpdate({
            target: bookmakers.key,
            set: { ...values, updatedAt: sql`now()` },
          });
      }
    });

    console.log(
      `Seed fertig: ${DATA_SOURCES.length} Quellen, ${COMPETITIONS.length} Wettbewerbe, ${BOOKMAKERS.length} Buchmacher.`,
    );
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
