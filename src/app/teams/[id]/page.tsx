import { CalendarClock, FlaskConical, HeartPulse, Ban, TriangleAlert, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FormChip } from "@/components/form-chip";
import { SourceFootnote, Sourced } from "@/components/source-note";
import { TrafficPill } from "@/components/status-badge";
import { GoalsByPeriodChart, XgChart } from "@/components/team-charts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { dateLong, dateShort, de1, de2, kickoffText, pct, signed } from "@/lib/format";
import { getTeamPage, type TeamPageData } from "@/lib/queries/team";
import { GOAL_PERIODS, summarizeTeam } from "@/lib/team-stats";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const data = Number.isInteger(Number(id)) ? await getTeamPage(Number(id)) : null;
  return { title: data?.team.name ?? "Team" };
}

const POSITION_SHORT = { goalkeeper: "TW", defender: "AB", midfielder: "MF", forward: "ST" } as const;

export default async function TeamPage({ params }: Props) {
  const { id } = await params;
  const teamId = Number(id);
  if (!Number.isInteger(teamId)) notFound();
  const now = new Date();
  const data = await getTeamPage(teamId, now);
  if (!data) notFound();

  const { team, standing, mainCompetition, form, nextMatch, stats } = data;
  const season = summarizeTeam(stats);
  const last5 = stats.slice(0, 5);
  const last5Summary = summarizeTeam(last5);

  return (
    <main className="mx-auto max-w-2xl space-y-4 px-4 pt-4 pb-16">
      {data.teamSource.isTestData && (
        <div className="flex items-start gap-2 rounded-lg border border-status-warn/40 bg-status-warn/10 px-3 py-2 text-sm text-status-warn">
          <FlaskConical className="mt-0.5 size-4 shrink-0" aria-hidden />
          <p>
            <strong>Testdaten.</strong> Verein, Spieler und Zahlen sind erfunden.
          </p>
        </div>
      )}

      <section aria-labelledby="teamname" className="space-y-3">
        <h1 id="teamname" className="text-3xl font-semibold tracking-tight">
          {team.name}
        </h1>
        {mainCompetition && (
          <p className="text-muted-foreground">
            <Link href={`/wettbewerbe/${mainCompetition.code}`} className="underline-offset-4 hover:text-foreground hover:underline">
              {mainCompetition.name}
            </Link>
          </p>
        )}

        {standing && (
          <div className="grid grid-cols-3 gap-2">
            <Tile label="Platz" value={`${standing.position}.`} sub={`von ${data.tableSize}`} />
            <Tile label="Punkte" value={String(standing.points)} sub={`${standing.played} Spiele`} />
            <Tile label="Tordifferenz" value={signed(standing.goalDifference)} sub={`${standing.goalsFor}:${standing.goalsAgainst} Tore`} />
          </div>
        )}

        {form.length > 0 && (
          <div>
            <p className="mb-1.5 text-xs text-muted-foreground">Form, letzte {form.length} Spiele (neuestes links)</p>
            <ol className="flex gap-1.5">
              {form.map((f) => (
                <li key={f.id}>
                  <Sourced source={f.source} label={`${f.isHome ? "gegen" : "bei"} ${f.opponent.name}`} className="no-underline">
                    <FormChip outcome={f.result!.outcome} />
                  </Sourced>
                </li>
              ))}
            </ol>
          </div>
        )}

        {nextMatch && (
          <p className="flex items-start gap-2 text-sm text-muted-foreground">
            <CalendarClock className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>
              Nächstes Spiel: {nextMatch.isHome ? "Heim gegen" : "Auswärts bei"}{" "}
              <Link href={`/teams/${nextMatch.opponent.id}`} className="underline-offset-4 hover:text-foreground hover:underline">
                {nextMatch.opponent.name}
              </Link>
              , {nextMatch.competition.name}, {kickoffText(nextMatch.kickoffAt, nextMatch.kickoffTimeKnown)}
            </span>
          </p>
        )}
      </section>

      <AvailabilityCard data={data} />

      {stats.length > 0 ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Teamstatistik</CardTitle>
              <p className="text-sm text-muted-foreground">
                Saisonmittel aus {season.matches} Spielen, daneben die letzten {last5Summary.matches}
              </p>
            </CardHeader>
            <CardContent>
              <dl className="divide-y">
                <div className="grid grid-cols-[1fr_auto_auto] gap-x-4 pb-1 text-xs text-muted-foreground">
                  <span />
                  <span className="w-16 text-right">Saison</span>
                  <span className="w-16 text-right">Letzte {last5Summary.matches}</span>
                </div>
                {(
                  [
                    ["Tore je Spiel", season.goalsPerMatch, last5Summary.goalsPerMatch, de1],
                    ["Gegentore je Spiel", season.concededPerMatch, last5Summary.concededPerMatch, de1],
                    ["xG je Spiel", season.xgPerMatch, last5Summary.xgPerMatch, de2],
                    ["xGA je Spiel", season.xgaPerMatch, last5Summary.xgaPerMatch, de2],
                    ["Ballbesitz", season.possessionPct === null ? null : season.possessionPct / 100, last5Summary.possessionPct === null ? null : last5Summary.possessionPct / 100, pct],
                    ["Passquote", season.passAccuracyPct === null ? null : season.passAccuracyPct / 100, last5Summary.passAccuracyPct === null ? null : last5Summary.passAccuracyPct / 100, pct],
                    ["Schüsse je Spiel", season.shotsPerMatch, last5Summary.shotsPerMatch, de1],
                    ["davon aufs Tor", season.shotsOnTargetPerMatch, last5Summary.shotsOnTargetPerMatch, de1],
                    ["Ecken je Spiel", season.cornersPerMatch, last5Summary.cornersPerMatch, de1],
                    ["PPDA (niedriger = mehr Pressing)", season.ppda, last5Summary.ppda, de1],
                    ["Zu-Null-Quote", season.cleanSheetRate, last5Summary.cleanSheetRate, pct],
                  ] as const
                ).map(([label, a, b, fmt]) => (
                  <div key={label} className="grid grid-cols-[1fr_auto_auto] items-baseline gap-x-4 py-1.5">
                    <dt className="text-sm text-muted-foreground">{label}</dt>
                    <dd className="w-16 text-right text-lg font-semibold tabular-nums">
                      {a === null ? "–" : <Sourced source={stats[0]!.source} label={label}>{fmt.format(a)}</Sourced>}
                    </dd>
                    <dd className="w-16 text-right text-lg tabular-nums text-muted-foreground">{b === null ? "–" : fmt.format(b)}</dd>
                  </div>
                ))}
              </dl>
              {season.setPieceGoals !== null && (
                <p className="mt-2 text-xs text-muted-foreground">Tore nach Standards in der Saison: {season.setPieceGoals}</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>xG und xGA je Spiel</CardTitle>
              <p className="text-sm text-muted-foreground">
                <span className="mr-1 inline-block size-2 rounded-sm bg-chart-1 align-middle" aria-hidden />
                eigene Torchancen (xG)
                <span className="mr-1 ml-3 inline-block size-2 rounded-sm bg-chart-2 align-middle" aria-hidden />
                zugelassene (xGA)
              </p>
            </CardHeader>
            <CardContent>
              <XgChart
                points={[...stats]
                  .reverse()
                  .filter((s) => s.xg !== null && s.xga !== null)
                  .map((s) => ({ label: dateShort(s.kickoffAt), opponent: s.opponent, xg: s.xg!, xga: s.xga! }))}
              />
            </CardContent>
          </Card>

          {Object.keys(season.goalsByPeriod).length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Tore nach Spielabschnitten</CardTitle>
              </CardHeader>
              <CardContent>
                <GoalsByPeriodChart
                  data={GOAL_PERIODS.map((p) => ({ period: p, goals: season.goalsByPeriod[p] ?? 0 }))}
                />
              </CardContent>
            </Card>
          )}
        </>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Teamstatistik</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Für diesen Verein liegt keine Teamstatistik vor. Ohne API-Key gibt es dafür noch keine
              zulässige Quelle; angezeigt werden nur Ergebnisse und Tabelle.
            </p>
          </CardContent>
        </Card>
      )}

      {data.squad.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="size-4" aria-hidden /> Kader
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y">
              {data.squad.map((p) => (
                <li key={p.id}>
                  <Link href={`/spieler/${p.id}`} className="flex items-center gap-3 py-2 hover:text-primary">
                    <span className="w-6 text-right text-sm tabular-nums text-muted-foreground">{p.shirtNumber}</span>
                    <span className="flex-1">{p.name}</span>
                    <span className="text-xs text-muted-foreground">{p.position ? POSITION_SHORT[p.position] : ""}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <SourceFootnote source={form[0]?.source ?? data.teamSource} />
    </main>
  );
}

function Tile({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-xl bg-card px-3 py-2.5 ring-1 ring-foreground/10">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-2xl font-semibold tabular-nums">{value}</p>
      <p className="text-xs text-muted-foreground">{sub}</p>
    </div>
  );
}

function AvailabilityCard({ data }: { data: TeamPageData }) {
  if (data.squad.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Ausfälle</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Keine Kaderdaten vorhanden. Verletzungen und Sperren gibt es ohne API-Key nur in den
            Testdaten.
          </p>
        </CardContent>
      </Card>
    );
  }
  const { absences, atRisk } = data;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Ausfälle und Sperrgefahr</CardTitle>
        <p className="text-sm text-muted-foreground">
          {absences.length === 0 ? "Keine Ausfälle gemeldet." : `${absences.length} ${absences.length === 1 ? "Spieler fällt" : "Spieler fallen"} aus.`}
        </p>
      </CardHeader>
      {(absences.length > 0 || atRisk.length > 0) && (
        <CardContent>
          <ul className="space-y-2">
            {absences.map((a) => (
              <li key={`${a.kind}-${a.player.id}`} className="flex items-center gap-3">
                <span
                  className={cn(
                    "flex size-7 shrink-0 items-center justify-center rounded-md ring-1",
                    a.kind === "angeschlagen"
                      ? "bg-status-warn/15 text-status-warn ring-status-warn/40"
                      : "bg-status-danger/15 text-status-danger ring-status-danger/40",
                  )}
                >
                  {a.kind === "gesperrt" ? <Ban className="size-4" aria-hidden /> : a.kind === "verletzt" ? <HeartPulse className="size-4" aria-hidden /> : <TriangleAlert className="size-4" aria-hidden />}
                </span>
                <span className="min-w-0 flex-1">
                  <Link href={`/spieler/${a.player.id}`} className="block truncate font-medium hover:text-primary">
                    {a.player.name}
                  </Link>
                  <span className="block truncate text-xs text-muted-foreground">
                    <Sourced source={a.source} label={`Status ${a.player.name}`}>
                      {a.kind === "gesperrt" ? "Gesperrt" : a.kind === "verletzt" ? "Verletzt" : "Angeschlagen"}
                    </Sourced>
                    {a.detail && ` · ${a.detail}`}
                    {a.expectedReturn && ` · bis ${dateLong(a.expectedReturn)}`}
                  </span>
                </span>
              </li>
            ))}
            {atRisk.map((r) => (
              <li key={`risk-${r.player.id}`} className="flex items-center gap-3">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-status-warn/15 text-xs font-bold text-status-warn ring-1 ring-status-warn/40">
                  {r.count}
                </span>
                <span className="min-w-0 flex-1">
                  <Link href={`/spieler/${r.player.id}`} className="block truncate font-medium hover:text-primary">
                    {r.player.name}
                  </Link>
                  <span className="block text-xs text-muted-foreground">
                    <TrafficPill traffic="warn">Sperrgefährdet</TrafficPill> {r.count} Gelbe · {r.competitionName}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </CardContent>
      )}
    </Card>
  );
}
