import { ChevronRight, FlaskConical } from "lucide-react";
import Link from "next/link";
import { dateLong } from "@/lib/format";
import { latestResultDates, listCompetitionsWithData } from "@/lib/queries/competition";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [competitions, lastResults] = await Promise.all([listCompetitionsWithData(), latestResultDates()]);

  return (
    <main className="mx-auto max-w-2xl space-y-6 px-4 pt-6 pb-16">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Fußball-Hub</h1>
        <p className="mt-1 text-muted-foreground">Wer spielt, wer fehlt, wer ist in Form.</p>
      </div>

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
                      <span className="block text-xs">Noch keine Quelle ohne API-Key</span>
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
