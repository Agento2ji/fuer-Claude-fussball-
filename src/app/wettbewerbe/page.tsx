import { ChevronRight, FlaskConical } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { dateLong } from "@/lib/format";
import { kickoffText } from "@/lib/format";
import { latestResultDates, listCompetitionsWithData } from "@/lib/queries/competition";
import { upcomingMatches } from "@/lib/queries/match";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Ligen und Spiele",
  description: "Nächste Spiele und alle Wettbewerbe mit Tabelle und Datenstand.",
};

export default async function LeaguesPage() {
  const now = new Date();
  const [competitions, lastResults, next] = await Promise.all([
    listCompetitionsWithData(),
    latestResultDates(),
    upcomingMatches(now),
  ]);

  return (
    <main className="mx-auto max-w-2xl space-y-6 px-4 pt-6 pb-16">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Ligen und Spiele</h1>
        <p className="mt-1 text-muted-foreground">Spielpläne, Tabellen und Teams als Hintergrund zu den Quoten.</p>
      </div>

      {next.length > 0 && (
        <section aria-labelledby="naechste">
          <h2 id="naechste" className="mb-2 text-sm font-medium text-muted-foreground">Nächste Spiele</h2>
          <ul className="divide-y rounded-xl border bg-card">
            {next.map((m) => (
              <li key={m.id}>
                <Link href={`/spiele/${m.id}`} className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/50">
                  <span className="flex-1">
                    <span className="block text-xs text-muted-foreground">
                      {m.isTestData && <FlaskConical className="mr-1 inline size-3 text-status-warn" aria-label="Testdaten" />}
                      {m.competition} · {kickoffText(m.kickoffAt, m.kickoffTimeKnown)}
                    </span>
                    <span className="block">{m.homeName} – {m.awayName}</span>
                  </span>
                  <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="wettbewerbe">
        <h2 id="wettbewerbe" className="mb-2 text-sm font-medium text-muted-foreground">Wettbewerbe</h2>
        <ul className="divide-y rounded-xl border bg-card">
          {competitions.map((c) => {
            const last = lastResults.get(c.code);
            return (
              <li key={c.code}>
                {c.matches > 0 ? (
                  <Link href={`/wettbewerbe/${c.code}`} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/50">
                    {c.isTestData && <FlaskConical className="size-4 text-status-warn" aria-label="Testdaten" />}
                    <span className="flex-1">
                      <span className="block">{c.name}</span>
                      <span className="block text-xs text-muted-foreground">
                        {c.matches} Spiele{last ? ` · letztes Ergebnis ${dateLong(last)}` : ""}
                      </span>
                    </span>
                    <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
                  </Link>
                ) : (
                  <div className="flex items-center gap-3 px-4 py-3 text-muted-foreground">
                    <span className="flex-1">
                      <span className="block">{c.name}</span>
                      <span className="block text-xs">Keine Daten im kostenlosen Tarif</span>
                    </span>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </section>
    </main>
  );
}
