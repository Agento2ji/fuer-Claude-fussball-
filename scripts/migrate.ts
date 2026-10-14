/** Spielt alle Migrationen aus ./drizzle ein. */
import { config } from "dotenv";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { createDb } from "../src/db/client";
import { parseServerEnv } from "../src/lib/env";

config({ path: ".env.local" });

async function main() {
  const env = parseServerEnv(process.env);
  const { db, client } = createDb(env.DATABASE_URL, 1);
  try {
    await migrate(db, { migrationsFolder: "./drizzle" });
    console.log("Migrationen eingespielt.");
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
