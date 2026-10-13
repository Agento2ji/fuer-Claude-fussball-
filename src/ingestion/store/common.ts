import { and, eq } from "drizzle-orm";
import type { PgDatabase } from "drizzle-orm/pg-core";
import type { PostgresJsQueryResultHKT } from "drizzle-orm/postgres-js";
import * as schema from "@/db/schema";
import { dataConflicts, dataSources, externalIds } from "@/db/schema";

/** Datenbank oder laufende Transaktion. */
export type DbLike = PgDatabase<PostgresJsQueryResultHKT, typeof schema>;

export type EntityType = (typeof schema.entityType.enumValues)[number];

export interface SourceInfo {
  id: number;
  priority: number;
}

/** Lädt alle Quellen; Schlüssel → ID und Priorität. */
export async function loadSources(db: DbLike): Promise<Map<string, SourceInfo>> {
  const rows = await db
    .select({ id: dataSources.id, key: dataSources.key, priority: dataSources.priority })
    .from(dataSources);
  return new Map(rows.map((r) => [r.key, { id: r.id, priority: r.priority }]));
}

export function requireSource(
  sources: Map<string, SourceInfo>,
  key: string,
): SourceInfo {
  const s = sources.get(key);
  if (!s) {
    throw new Error(
      `Datenquelle „${key}“ fehlt in data_sources – erst \`npm run db:seed\` ausführen.`,
    );
  }
  return s;
}

/** Alle Zuordnungen externe ID → interne ID für eine Quelle und Entität. */
export async function loadMappings(
  db: DbLike,
  sourceId: number,
  entityType: EntityType,
): Promise<Map<string, number>> {
  const rows = await db
    .select({ ext: externalIds.externalId, id: externalIds.entityId })
    .from(externalIds)
    .where(and(eq(externalIds.sourceId, sourceId), eq(externalIds.entityType, entityType)));
  return new Map(rows.map((r) => [r.ext, r.id]));
}

export async function link(
  db: DbLike,
  sourceId: number,
  entityType: EntityType,
  entityId: number,
  externalId: string,
): Promise<void> {
  await db
    .insert(externalIds)
    .values({ sourceId, entityType, entityId, externalId })
    .onConflictDoNothing();
}

export interface ConflictInput {
  entityType: EntityType;
  entityId: number;
  field: string;
  keptSourceId: number;
  keptValue: string | null;
  otherSourceId: number;
  otherValue: string | null;
  unconfirmed: boolean;
}

/**
 * Protokolliert einen Quellenkonflikt. Derselbe Konflikt wird nicht bei
 * jedem Lauf erneut angelegt.
 */
export async function logConflict(db: DbLike, c: ConflictInput): Promise<boolean> {
  const existing = await db
    .select({ id: dataConflicts.id })
    .from(dataConflicts)
    .where(
      and(
        eq(dataConflicts.entityType, c.entityType),
        eq(dataConflicts.entityId, c.entityId),
        eq(dataConflicts.field, c.field),
        eq(dataConflicts.keptSourceId, c.keptSourceId),
        eq(dataConflicts.otherSourceId, c.otherSourceId),
        c.keptValue === null
          ? undefined
          : eq(dataConflicts.keptValue, c.keptValue),
        c.otherValue === null
          ? undefined
          : eq(dataConflicts.otherValue, c.otherValue),
      ),
    )
    .limit(1);
  if (existing.length > 0) return false;
  await db.insert(dataConflicts).values(c);
  return true;
}
