import { ArrowLeft, FlaskConical } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AgeGate, GamblingHelpNotice, ValueDisclaimer } from "@/components/gambling-notice";
import { LicenseCard, MarketTable, ValueBetCards } from "@/components/odds-view";
import { SourceFootnote } from "@/components/source-note";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { isAgeConfirmed } from "@/lib/age-gate-check";
import { kickoffText } from "@/lib/format";
import { getMatchPage } from "@/lib/queries/match";
import { getMatchOdds } from "@/lib/queries/odds";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export const metadata: Metadata = { title: "Quotenvergleich", robots: { index: false } };

export default async function MatchOddsPage({ params }: Props) {
  const { id } = await params;
  const matchId = Number(id);
  if (!Number.isInteger(matchId)) notFound();
  const match = await getMatchPage(matchId);
  if (!match) notFound();
  const confirmed = await isAgeConfirmed();
  const home = match.home.name;
  const away = match.away.name;

  return (
    <main className="mx-auto max-w-2xl space-y-4 px-4 pt-4 pb-16">
      <Link href={`/spiele/${matchId}`} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden /> Zum Spiel
      </Link>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Quotenvergleich</h1>
        <p className="text-muted-foreground">
          {home} – {away} · {kickoffText(match.match.kickoffAt, match.match.kickoffTimeKnown)}
        </p>
      </div>

      {!confirmed ? (
        <AgeGate />
      ) : (
        <OddsContent matchId={matchId} home={home} away={away} isTestData={match.competition.isTestData} />
      )}
    </main>
  );
}

async function OddsContent({ matchId, home, away, isTestData }: { matchId: number; home: string; away: string; isTestData: boolean }) {
  const odds = await getMatchOdds(matchId);
  return (
    <>
      <GamblingHelpNotice />
      {isTestData && (
        <div className="flex items-start gap-2 rounded-lg border border-status-warn/40 bg-status-warn/10 px-3 py-2 text-sm text-status-warn">
          <FlaskConical className="mt-0.5 size-4 shrink-0" aria-hidden />
          <p><strong>Testdaten.</strong> Die Quoten sind erfunden und dienen nur der Entwicklung.</p>
        </div>
      )}
      {odds.markets.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Für dieses Spiel liegen keine Quoten vor. Echte Quoten gibt es erst mit einem Key für The Odds API.
        </p>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Auffällige Abweichungen</CardTitle>
              <p className="text-sm text-muted-foreground">
                Bis zu drei Tipps mit dem besten Verhältnis aus Erwartungswert und Schwankung.
              </p>
            </CardHeader>
            <CardContent className="space-y-3">
              <ValueBetCards bets={odds.top} home={home} away={away} />
              <ValueDisclaimer />
            </CardContent>
          </Card>
          {odds.markets.map((m) => (
            <MarketTable key={`${m.market}-${m.line}`} market={m} home={home} away={away} />
          ))}
          <LicenseCard />
          {odds.source && <SourceFootnote source={odds.source} />}
        </>
      )}
    </>
  );
}
