import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

/**
 * Erzeugt eine Datenbankverbindung. Für App und Skripte gleichermaßen.
 * Hinter einem Verbindungs-Pooler (Neon „-pooler“) ohne Prepared Statements,
 * weil der Pooler Verbindungen zwischen Anfragen wechselt.
 */
export function createDb(url: string, max = 5) {
  const pooled = /-pooler\./.test(url);
  const client = postgres(url, { max, prepare: !pooled, onnotice: () => {} });
  return { db: drizzle(client, { schema }), client };
}

export type Db = ReturnType<typeof createDb>["db"];
