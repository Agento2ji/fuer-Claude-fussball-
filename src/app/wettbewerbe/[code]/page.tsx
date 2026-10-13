import { FlaskConical, TriangleAlert } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FormChip } from "@/components/form-chip";
import { SourceFootnote } from "@/components/source-note";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { dateLong, kickoffText, signed } from "@/lib/format";
import { getCompetitionPage } from "@/lib/queries/competition";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ code: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { code } = await params;
  const data = await getCompetitionPage(code.toUpperCase());
  return {
    title: data?.competition.name ?? "Wettbewerb",
    description: data ? `${data.competition.name}: Tabelle und nächste Spiele.` : undefined,
  };
}

export default async function CompetitionPage({ params }: Props) {
  const { code } = await params;
  const now = new Date();
  const data = await getCompetitionPage(code.toUpperCase(), now);
  if (!data) notFound();
  const { competition, standings, upcoming } = data;

  return (
    <main className="mx-auto max-w-2xl space-y-4 px-4 pt-4 pb-16">
      {competition.isTestData && (
        <div className="flex items-start gap-2 rounded-lg border border-status-warn/40 bg-status-warn/10 px-3 py-2 text-sm text-status-warn">
          <FlaskConical className="mt-0.5 size-4 shrink-0" aria-hidden />
          <p><strong>Testdaten.</strong> Liga, Vereine und Ergebnisse sind erfunden.</p>
        </div>
      )}
      <h1 className="text-3xl font-semibold tracking-tight">{competition.name}</h1>

      {data.overdue > 0 && (
        <div role="note" className="flex items-start gap-2 rounded-lg border border-status-warn/40 bg-status-warn/10 px-3 py-2 text-sm">
          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-status-warn" aria-hidden />
          <p>
            <strong className="text-status-warn">Tabelle nicht aktuell.</strong> Bei {data.overdue} bereits
            gespielten Partien fehlt in der Quelle noch das Ergebnis
            {data.lastResult && <> (letztes Ergebnis vom {dateLong(data.lastResult)})</>}.
          </p>
        </div>
      )}

      {standings.length === 0 ? (
        <p className="text-muted-foreground">Für diesen Wettbewerb liegen noch keine Spiele vor.</p>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Tabelle</CardTitle>
            <p className="text-xs text-muted-foreground">
              Berechnet aus den Ergebnissen: Punkte, Tordifferenz, Tore. Der direkte Vergleich ist
              nicht berücksichtigt.
            </p>
          </CardHeader>
          <CardContent className="px-0 sm:px-4">
            <table className="w-full text-sm">
              <caption className="sr-only">Tabelle {competition.name}</caption>
              <thead>
                <tr className="text-xs text-muted-foreground">
                  <th scope="col" className="w-8 py-1.5 pl-4 text-right font-normal sm:pl-0">#</th>
                  <th scope="col" className="py-1.5 pl-3 text-left font-normal">Verein</th>
                  <th scope="col" className="w-8 py-1.5 text-right font-normal"><abbr title="Spiele">Sp</abbr></th>
                  <th scope="col" className="w-10 py-1.5 text-right font-normal"><abbr title="Tordifferenz">TD</abbr></th>
                  <th scope="col" className="w-12 py-1.5 pr-4 text-right font-normal sm:pr-0"><abbr title="Punkte">Pkt</abbr></th>
                  <th scope="col" className="hidden py-1.5 pr-4 pl-3 text-left font-normal sm:table-cell sm:pr-0">Form</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {standings.map((r) => (
                  <tr key={r.teamId}>
                    <td className="py-2 pl-4 text-right tabular-nums text-muted-foreground sm:pl-0">{r.position}</td>
                    <td className="max-w-0 truncate py-2 pl-3">
                      <Link href={`/teams/${r.teamId}`} className="hover:text-primary">{r.name}</Link>
                    </td>
                    <td className="py-2 text-right tabular-nums text-muted-foreground">{r.played}</td>
                    <td className="py-2 text-right tabular-nums text-muted-foreground">{signed(r.goalDifference)}</td>
                    <td className="py-2 pr-4 text-right font-semibold tabular-nums sm:pr-0">{r.points}</td>
                    <td className="hidden py-2 pr-4 pl-3 sm:table-cell sm:pr-0">
                      <span className="flex gap-1">
                        {r.form.map((f, i) => <FormChip key={i} outcome={f} size="sm" />)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {upcoming.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Nächste Spiele</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y">
              {upcoming.map((m) => (
                <li key={m.id} className="py-2">
                  <p className="text-xs text-muted-foreground">
                    {m.matchday && `${m.matchday}. Spieltag · `}
                    {kickoffText(m.kickoffAt, m.kickoffTimeKnown)}
                  </p>
                  <Link href={`/spiele/${m.id}`} className="block hover:text-primary">
                    {m.home.name}
                    <span className="text-muted-foreground"> – </span>
                    {m.away.name}
                  </Link>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {data.source && <SourceFootnote source={data.source} />}
    </main>
  );
}
