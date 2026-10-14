/**
 * Datenabruf von der Kommandozeile.
 *
 *   npm run ingest -- spiele [CODE …]   Spielpläne/Ergebnisse (Standard: alle Wettbewerbe)
 *   npm run ingest -- quoten [CODE …]   Quoten (braucht THE_ODDS_API_KEY)
 *   npm run ingest -- testdaten         Erfundene Testliga einspielen
 *   npm run ingest -- alle              Spiele und Quoten aller Wettbewerbe
 */
import { config } from "dotenv";
import { COMPETITIONS } from "../src/config/competitions";
import { createDb } from "../src/db/client";
import { type JobReport, runJob } from "../src/ingestion/jobs/run-job";
import { syncMatches, syncOdds, syncTestdaten } from "../src/ingestion/jobs/sync";
import { parseServerEnv } from "../src/lib/env";

config({ path: ".env.local", quiet: true });

const USAGE = "Aufruf: npm run ingest -- <spiele|quoten|testdaten|alle> [CODE …] [--probelauf]";

/** Probelauf: alles abrufen und zuordnen, am Ende aber nichts speichern. */
class Probelauf extends Error {}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--probelauf");
  const [command, ...codesArg] = args.filter((a) => a !== "--probelauf");
  const env = parseServerEnv(process.env);
  const { db, client } = createDb(env.DATABASE_URL, 1);
  const all = COMPETITIONS.map((c) => c.code as string);
  const codes = codesArg.length ? codesArg : all;
  const unknown = codes.filter((c) => !all.includes(c));
  if (unknown.length) throw new Error(`Unbekannte Wettbewerbe: ${unknown.join(", ")}`);

  const reports: JobReport[] = [];
  try {
    switch (command) {
      case "spiele":
        if (dryRun) {
          await db
            .transaction(async (tx) => {
              for (const c of codes) reports.push(await runJob(tx, `spiele:${c}`, () => syncMatches(tx, c)));
              throw new Probelauf();
            })
            .catch((err: unknown) => {
              if (!(err instanceof Probelauf)) throw err;
            });
          console.log("Probelauf: nichts gespeichert.");
          break;
        }
        for (const c of codes) reports.push(await runJob(db, `spiele:${c}`, () => syncMatches(db, c)));
        break;
      case "quoten":
        for (const c of codes) reports.push(await runJob(db, `quoten:${c}`, () => syncOdds(db, c)));
        break;
      case "testdaten":
        reports.push(await runJob(db, "testdaten", () => syncTestdaten(db)));
        break;
      case "alle":
        for (const c of all) reports.push(await runJob(db, `spiele:${c}`, () => syncMatches(db, c)));
        for (const c of all) reports.push(await runJob(db, `quoten:${c}`, () => syncOdds(db, c)));
        break;
      default:
        console.error(USAGE);
        process.exitCode = 2;
        return;
    }
  } finally {
    await client.end();
  }

  for (const r of reports) {
    const head = `${r.job.padEnd(14)} ${r.status.padEnd(9)} ${String(r.itemsWritten).padStart(5)} Zeilen  ${r.durationMs} ms`;
    console.log(head);
    if (r.error) console.log(`  Fehler: ${r.error}`);
    const d = r.details ?? {};
    if (typeof d.grund === "string") console.log(`  ${d.grund}`);
    if (typeof d.anbieter === "string") console.log(`  Anbieter: ${d.anbieter}`);
    for (const w of (d.warnings as string[] | undefined) ?? []) console.log(`  Hinweis: ${w}`);
    const newTeams = (d.newTeams as string[] | undefined) ?? [];
    if (newTeams.length) console.log(`  Neue Teams (${newTeams.length}): ${newTeams.join("; ")}`);
    if (typeof d.inserted === "number") {
      console.log(`  Spiele: ${d.inserted} neu, ${d.updated} aktualisiert, ${d.unchanged} unverändert`);
    }
    if (typeof d.conflicts === "number" && d.conflicts > 0) console.log(`  Neue Quellenkonflikte: ${d.conflicts}`);
    for (const c of ((d.conflictDetails as string[] | undefined) ?? []).slice(0, 8)) console.log(`    ${c}`);
    for (const a of (d.versuche as { provider: string; outcome: string; error?: string }[] | undefined) ?? []) {
      if (a.outcome === "fehlgeschlagen") console.log(`  ${a.provider} fehlgeschlagen: ${a.error ?? "?"}`);
    }
    const unmatched = (d.nichtZugeordnet as string[] | undefined) ?? [];
    if (unmatched.length) console.log(`  Keinem Spiel zugeordnet (${unmatched.length}): ${unmatched.slice(0, 5).join("; ")}`);
    const quota = d.kontingent as Record<string, string> | undefined;
    if (quota?.["x-requests-remaining"]) {
      console.log(`  Kontingent: ${quota["x-requests-remaining"]} übrig, ${quota["x-requests-used"] ?? "?"} verbraucht`);
    }
    if (r.job === "testdaten") console.log(`  ${JSON.stringify(d)}`);
  }
  if (reports.some((r) => r.status === "failed")) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
