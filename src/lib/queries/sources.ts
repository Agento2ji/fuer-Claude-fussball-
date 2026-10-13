import "server-only";
import { dataSources } from "@/db/schema";
import { getDb } from "@/db";

/** Herkunft eines angezeigten Werts, für den Quellenhinweis in der UI. */
export interface SourceRef {
  name: string;
  key: string;
  fetchedAt: Date;
  url: string | null;
  isTestData: boolean;
}

/** Liefert eine Funktion, die Quell-ID, Abrufzeit und URL zu einer SourceRef macht. */
export async function sourceResolver() {
  const rows = await getDb()
    .select({ id: dataSources.id, key: dataSources.key, name: dataSources.name, kind: dataSources.kind })
    .from(dataSources);
  const byId = new Map(rows.map((r) => [r.id, { key: r.key, name: r.name, isTestData: r.kind === "testdaten" }]));
  return (sourceId: number, fetchedAt: Date, url: string | null): SourceRef => ({
    ...(byId.get(sourceId) ?? { key: "unbekannt", name: "Unbekannte Quelle", isTestData: false }),
    fetchedAt,
    url,
  });
}
