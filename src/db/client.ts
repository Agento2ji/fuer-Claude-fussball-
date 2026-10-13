import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

/**
 * libpq-Parameter, die postgres.js nicht kennt. Er würde sie sonst als
 * Server-Einstellung mitschicken, und der Server lehnt die Verbindung ab.
 * Neon hängt `channel_binding=require` standardmäßig an.
 */
const LIBPQ_ONLY = ["channel_binding"];

/** Verbindungs-String für postgres.js bereinigen. */
export function toPostgresJsUrl(url: string): string {
  const parsed = new URL(url);
  for (const key of LIBPQ_ONLY) parsed.searchParams.delete(key);
  return parsed.toString();
}

/**
 * Erzeugt eine Datenbankverbindung. Für App und Skripte gleichermaßen.
 * Hinter einem Verbindungs-Pooler (Neon „-pooler“) ohne Prepared Statements,
 * weil der Pooler Verbindungen zwischen Anfragen wechselt.
 */
export function createDb(url: string, max = 5) {
  const pooled = /-pooler\./.test(url);
  const client = postgres(toPostgresJsUrl(url), { max, prepare: !pooled, onnotice: () => {} });
  return { db: drizzle(client, { schema }), client };
}

export type Db = ReturnType<typeof createDb>["db"];
