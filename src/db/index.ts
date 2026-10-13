import "server-only";
import { serverEnv } from "@/lib/env";
import { createDb, type Db } from "./client";

// Eine Verbindung pro Prozess, auch über Hot-Reloads im Dev-Modus hinweg.
const globalForDb = globalThis as unknown as { db?: Db };

export function getDb(): Db {
  globalForDb.db ??= createDb(serverEnv().DATABASE_URL).db;
  return globalForDb.db;
}
