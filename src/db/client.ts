import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

/** Erzeugt eine Datenbankverbindung. Für App und Skripte gleichermaßen. */
export function createDb(url: string, max = 5) {
  const client = postgres(url, { max, onnotice: () => {} });
  return { db: drizzle(client, { schema }), client };
}

export type Db = ReturnType<typeof createDb>["db"];
