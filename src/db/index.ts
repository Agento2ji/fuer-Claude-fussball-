import "server-only";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { serverEnv } from "@/lib/env";
import * as schema from "./schema";

function createDb() {
  const client = postgres(serverEnv().DATABASE_URL, { max: 5 });
  return drizzle(client, { schema });
}

type Db = ReturnType<typeof createDb>;

// Eine Verbindung pro Prozess, auch über Hot-Reloads im Dev-Modus hinweg.
const globalForDb = globalThis as unknown as { db?: Db };

export function getDb(): Db {
  globalForDb.db ??= createDb();
  return globalForDb.db;
}
