/** Spielt alle Migrationen aus ./drizzle ein. */
import { config } from "dotenv";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { parseServerEnv } from "../src/lib/env";

config({ path: ".env.local" });

async function main() {
  const env = parseServerEnv(process.env);
  const client = postgres(env.DATABASE_URL, { max: 1, onnotice: () => {} });
  try {
    await migrate(drizzle(client), { migrationsFolder: "./drizzle" });
    console.log("Migrationen eingespielt.");
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
