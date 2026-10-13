import { CalendarClock, FileSignature, FlaskConical, Newspaper, Shirt } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SeasonChart } from "@/components/season-chart";
import { SourceFootnote, Sourced } from "@/components/source-note";
import { StatusBadge, TrafficPill } from "@/components/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  age,
  monthsBetween,
  playerStatus,
  type StatLine,
  type StatSummary,
  summarize,
  yellowCardRisk,
} from "@/lib/player-status";
import { getPlayerPage, type PlayerPageData } from "@/lib/queries/player";
import { formatBerlin } from "@/lib/time";
import { dateLong, dateShort, de1, de2, eur, kickoffText, pct } from "@/lib/format";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";


type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const data = await getPlayerPage(Number(id));
  return { title: data?.player.name ?? "Spieler" };
}

export default async function PlayerPage({ params }: Props) {
  const { id } = await params;
  const playerId = Number(id);
  if (!Number.isInteger(playerId)) notFound();
  const now = new Date();
  const data = await getPlayerPage(playerId, now);
  if (!data) notFound();

  const { player, team, injury, suspension, contract, games, mainCompetition } = data;
  const status = playerStatus({ activeInjury: injury, activeSuspension: suspension });
  const isGk = player.position === "goalkeeper";
  const statusDetail = suspension
    ? suspension.firstEligible
      ? `Wieder spielberechtigt ab ${dateLong(suspension.firstEligible.kickoffAt)} gegen ${suspension.firstEligible.opponent}`
      : `${suspension.matchesCount} ${suspension.matchesCount === 1 ? "Spiel" : "Spiele"} gesperrt`
    : injury
      ? `${injury.injuryType ?? "Verletzung"}${injury.expectedReturn ? ` · Rückkehr voraussichtlich ${dateLong(injury.expectedReturn)}` : ""}`
      : undefined;

  const last3 = games.slice(0, 3);
  const last3Comp = mainCompetition
    ? games.filter((g) => g.competition.id === mainCompetition.id).slice(0, 3)
    : [];
  const sameGames =
    last3.length === last3Comp.length && last3.every((g, i) => g.matchId === last3Comp[i]?.matchId);

  return (
    <main className="mx-auto max-w-2xl space-y-4 px-4 pt-4 pb-16">
      {data.playerSource.isTestData && (
        <div className="flex items-start gap-2 rounded-lg border border-status-warn/40 bg-status-warn/10 px-3 py-2 text-sm text-status-warn">
          <FlaskConical className="mt-0.5 size-4 shrink-0" aria-hidden />
          <p>
            <strong>Testdaten.</strong> Spieler, Verein und alle Zahlen sind erfunden und dienen nur
            dem Entwurf.
          </p>
        </div>
      )}

      {/* Kopf: Status zuerst, dann wer er ist */}
      <section aria-labelledby="spielername" className="space-y-3">
        <StatusBadge kind={status.kind} label={status.label} traffic={status.traffic} detail={statusDetail} />
        <div className="flex items-end justify-between gap-3">
          <div className="min-w-0">
            <h1 id="spielername" className="truncate text-3xl font-semibold tracking-tight">
              {player.name}
            </h1>
            <p className="text-muted-foreground">
              {team ? (
                <Link href={`/teams/${team.id}`} className="underline-offset-4 hover:text-foreground hover:underline">
                  {team.name}
                </Link>
              ) : (
                "Vereinslos"
              )}
              {player.detailedPosition && ` · ${player.detailedPosition}`}
              {player.birthDate && ` · ${age(player.birthDate, now)} Jahre`}
            </p>
          </div>
          {player.shirtNumber !== null && (
            <div className="flex shrink-0 items-center gap-1 text-muted-foreground" aria-label={`Rückennummer ${player.shirtNumber}`}>
              <Shirt className="size-4" aria-hidden />
              <span className="text-2xl font-semibold tabular-nums text-foreground">{player.shirtNumber}</span>
            </div>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {contract?.isLoan && <TrafficPill traffic="warn">Leihe</TrafficPill>}
          {data.yellowCards
            .filter((y) => yellowCardRisk(y.count, y.threshold).atRisk)
            .map((y) => (
              <TrafficPill key={y.competitionId} traffic="warn">
                Sperrgefährdet ({y.name})
              </TrafficPill>
            ))}
        </div>
        {data.nextMatch && (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <CalendarClock className="size-4" aria-hidden />
            Nächstes Spiel: {data.nextMatch.isHome ? "gegen" : "bei"} {data.nextMatch.opponent},{" "}
            {kickoffText(data.nextMatch.kickoffAt, data.nextMatch.kickoffTimeKnown)}
          </p>
        )}
      </section>

      {injury && <InjuryCard injury={injury} />}
      {suspension && <SuspensionCard suspension={suspension} />}
      {data.yellowCards.length > 0 && <YellowCardsCard yellowCards={data.yellowCards} />}

      <FormCard />

      {last3.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Letzte 3 Spiele</CardTitle>
            <p className="text-sm text-muted-foreground">
              {sameGames
                ? `Alle drei Spiele in ${mainCompetition?.name ?? "einem Wettbewerb"} – Gesamt und Wettbewerb sind hier gleich.`
                : `Gesamt im Vergleich zu den letzten 3 Spielen in ${mainCompetition?.name ?? "Wettbewerb"}`}
            </p>
          </CardHeader>
          <CardContent>
            <Comparison
              isGk={isGk}
              left={{ label: "Gesamt", summary: summarize(last3.map((g) => g.stats as StatLine)) }}
              right={
                sameGames
                  ? null
                  : { label: mainCompetition?.name ?? "Wettbewerb", summary: summarize(last3Comp.map((g) => g.stats as StatLine)) }
              }
            />
          </CardContent>
        </Card>
      )}

      {games.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Spiele im Detail</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {games.slice(0, 3).map((g) => (
              <MatchDetail key={g.matchId} game={g} isGk={isGk} />
            ))}
          </CardContent>
        </Card>
      )}

      {games.length > 1 && (
        <Card>
          <CardHeader>
            <CardTitle>Saisonverlauf</CardTitle>
            <p className="text-sm text-muted-foreground">
              <span className="mr-1 inline-block size-2 rounded-sm bg-chart-2 align-middle" aria-hidden />
              Note je Spiel
              <span className="mr-1 ml-3 inline-block size-2 rounded-full bg-chart-1 align-middle" aria-hidden />
              Scorerpunkte
            </p>
          </CardHeader>
          <CardContent>
            <SeasonChart
              points={[...games].reverse().map((g) => ({
                label: dateShort(g.kickoffAt),
                opponent: g.opponent,
                rating: g.stats.rating,
                scorer: (g.stats.goals ?? 0) + (g.stats.assists ?? 0),
                minutes: g.stats.minutes,
              }))}
            />
          </CardContent>
        </Card>
      )}

      {contract && <ContractCard contract={contract} now={now} />}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Newspaper className="size-4" aria-hidden /> News
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Noch keine News-Quelle angebunden. Kommt, sobald eine zulässige Quelle geprüft ist.
          </p>
        </CardContent>
      </Card>

      <SourceFootnote source={data.playerSource} />
    </main>
  );
}

// ---------------------------------------------------------------------------

function InjuryCard({ injury }: { injury: NonNullable<PlayerPageData["injury"]> }) {
  return (
    <Card className="ring-status-danger/30">
      <CardHeader>
        <CardTitle>{injury.status === "injured" ? "Verletzung" : "Angeschlagen"}</CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
          <Fact label="Art">{injury.injuryType ?? "unbekannt"}{injury.description && ` (${injury.description})`}</Fact>
          <Fact label="Fällt aus seit">{injury.since ? dateLong(injury.since) : "unbekannt"}</Fact>
          <Fact label="Rückkehr erwartet">{injury.expectedReturn ? dateLong(injury.expectedReturn) : "offen"}</Fact>
          <Fact label="Stand">
            <Sourced source={injury.source}>{formatBerlin(injury.source.fetchedAt, { dateStyle: "short", timeStyle: "short" })}</Sourced>
          </Fact>
        </dl>
      </CardContent>
    </Card>
  );
}

const REASON_LABEL = {
  yellow_accumulation: "Fünfte Gelbe Karte",
  yellow_red: "Gelb-Rote Karte",
  red: "Rote Karte",
  other: "Sonstige Sperre",
} as const;

function SuspensionCard({ suspension }: { suspension: NonNullable<PlayerPageData["suspension"]> }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Sperre</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
          <Fact label="Grund">{REASON_LABEL[suspension.reason]}</Fact>
          <Fact label="Gilt für">{suspension.competitionName ?? "Alle Wettbewerbe"}</Fact>
          <Fact label="Dauer">
            <Sourced source={suspension.source} label="Dauer der Sperre">
              {suspension.matchesCount} {suspension.matchesCount === 1 ? "Spiel" : "Spiele"}
            </Sourced>
          </Fact>
          <Fact label="Wieder dabei">
            {suspension.firstEligible
              ? `${dateLong(suspension.firstEligible.kickoffAt)} gegen ${suspension.firstEligible.opponent}`
              : "Spielplan noch offen"}
          </Fact>
        </dl>
        {suspension.missedMatches && suspension.missedMatches.length > 0 && (
          <p className="text-muted-foreground">
            Verpasst: {suspension.missedMatches.map((m) => `${m.opponent} (${dateShort(m.kickoffAt)})`).join(", ")}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function YellowCardsCard({ yellowCards }: { yellowCards: PlayerPageData["yellowCards"] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Gelbe Karten</CardTitle>
        <p className="text-sm text-muted-foreground">Je Wettbewerb getrennt gezählt</p>
      </CardHeader>
      <CardContent className="space-y-4">
        {yellowCards.map((y) => {
          const risk = yellowCardRisk(y.count, y.threshold);
          const filled = y.threshold ? y.threshold - (risk.untilSuspension ?? 0) : y.count;
          return (
            <div key={y.competitionId} className="space-y-1.5">
              <div className="flex items-baseline justify-between gap-2 text-sm">
                <span>{y.name}</span>
                <span>
                  <Sourced source={y.source} label={`Gelbe Karten ${y.name}`} className="text-lg font-semibold tabular-nums">
                    {y.count}
                  </Sourced>
                  {y.threshold && <span className="text-muted-foreground"> · Sperre bei {y.threshold}</span>}
                </span>
              </div>
              {y.threshold && (
                <div className="flex gap-1" aria-hidden>
                  {Array.from({ length: y.threshold }, (_, i) => (
                    <span key={i} className={cn("h-2 flex-1 rounded-full", i < filled ? (risk.atRisk ? "bg-status-warn" : "bg-foreground/60") : "bg-muted")} />
                  ))}
                </div>
              )}
              <p className={cn("text-sm", risk.atRisk ? "font-medium text-status-warn" : "text-muted-foreground")}>
                {risk.untilSuspension === null
                  ? "Sperrgrenze für diesen Wettbewerb nicht hinterlegt."
                  : risk.atRisk
                    ? "⚠ Sperrgefährdet: Die nächste Gelbe bedeutet eine Sperre."
                    : `Noch ${risk.untilSuspension} bis zur Sperre.`}
              </p>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

function FormCard() {
  return (
    <Card className="border-dashed">
      <CardHeader>
        <CardTitle>Formbewertung</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          Entwurf: Die Berechnung nach Abschnitt 5 (Perzentil gegen die eigene Karriere) folgt in
          Meilenstein 4. Hier steht dann die Stufe mit Perzentil, Spielanzahl und den zwei
          stärksten Einflussgrößen.
        </p>
      </CardContent>
    </Card>
  );
}

type Side = { label: string; summary: StatSummary };

function Comparison({ left, right, isGk }: { left: Side; right: Side | null; isGk: boolean }) {
  const rows: { label: string; get: (s: StatSummary) => number | null; fmt: (v: number) => string; higherIsBetter?: boolean }[] = isGk
    ? [
        { label: "Paraden", get: (s) => s.saves, fmt: String },
        { label: "Gegentore", get: (s) => s.goalsConceded, fmt: String, higherIsBetter: false },
        { label: "Verhinderte Tore", get: (s) => s.goalsPrevented, fmt: (v) => de2.format(v) },
        { label: "Passquote", get: (s) => s.passAccuracy, fmt: (v) => pct.format(v) },
        { label: "Note ⌀", get: (s) => s.rating, fmt: (v) => de1.format(v) },
      ]
    : [
        { label: "Tore", get: (s) => s.goals, fmt: String },
        { label: "Vorlagen", get: (s) => s.assists, fmt: String },
        { label: "xG", get: (s) => s.xg, fmt: (v) => de2.format(v) },
        { label: "xA", get: (s) => s.xa, fmt: (v) => de2.format(v) },
        { label: "Schlüsselpässe", get: (s) => s.keyPasses, fmt: String },
        { label: "Passquote", get: (s) => s.passAccuracy, fmt: (v) => pct.format(v) },
        { label: "Zweikampfquote", get: (s) => s.duelRate, fmt: (v) => pct.format(v) },
        { label: "Note ⌀", get: (s) => s.rating, fmt: (v) => de1.format(v) },
      ];
  return (
    <div>
      {right && (
        <div className="mb-2 grid grid-cols-[1fr_auto_auto] gap-x-4 text-xs text-muted-foreground">
          <span />
          <span className="w-16 text-right">{left.label}</span>
          <span className="w-20 text-right">{right.label}</span>
        </div>
      )}
      <dl className="divide-y">
        {rows.map((r) => {
          const a = r.get(left.summary);
          const b = right ? r.get(right.summary) : null;
          return (
            <div key={r.label} className={cn("grid items-baseline gap-x-4 py-1.5", right ? "grid-cols-[1fr_auto_auto]" : "grid-cols-[1fr_auto]")}>
              <dt className="text-sm text-muted-foreground">{r.label}</dt>
              <dd className="w-16 text-right text-lg font-semibold tabular-nums">{a === null ? "–" : r.fmt(a)}</dd>
              {right && <dd className="w-20 text-right text-lg tabular-nums text-muted-foreground">{b === null ? "–" : r.fmt(b)}</dd>}
            </div>
          );
        })}
      </dl>
      <p className="mt-2 text-xs text-muted-foreground">
        {right
          ? `${left.summary.matches} bzw. ${right.summary.matches} Spiele, ${left.summary.minutes} bzw. ${right.summary.minutes} Minuten`
          : `${left.summary.matches} Spiele, ${left.summary.minutes} Minuten`}
      </p>
    </div>
  );
}

function MatchDetail({ game, isGk }: { game: PlayerPageData["games"][number]; isGk: boolean }) {
  const s = game.stats;
  const outcome = game.result?.outcome;
  const field: [string, string | number | null][] = isGk
    ? [
        ["Minuten", s.minutes],
        ["Paraden", s.saves],
        ["Gegentore", s.goalsConceded],
        ["Verhinderte Tore", s.psxgFaced !== null && s.goalsConceded !== null ? de2.format(s.psxgFaced - s.goalsConceded) : null],
        ["Quote gehaltener Schüsse", s.saves !== null && s.goalsConceded !== null && s.saves + s.goalsConceded > 0 ? pct.format(s.saves / (s.saves + s.goalsConceded)) : null],
        ["Zu Null", s.cleanSheet === null ? null : s.cleanSheet ? "Ja" : "Nein"],
        ["Pässe", s.passes],
        ["Passquote", s.passes ? pct.format((s.passesCompleted ?? 0) / s.passes) : null],
        ["Karten", cardText(s.yellowCards, s.redCards)],
        ["Note", s.rating === null ? null : de1.format(s.rating)],
      ]
    : [
        ["Minuten", s.minutes],
        ["Tore", s.goals],
        ["Vorlagen", s.assists],
        ["Scorerpunkte", (s.goals ?? 0) + (s.assists ?? 0)],
        ["Schüsse (aufs Tor)", s.shots === null ? null : `${s.shots} (${s.shotsOnTarget ?? 0})`],
        ["xG", s.xg === null ? null : de2.format(s.xg)],
        ["xA", s.xa === null ? null : de2.format(s.xa)],
        ["Pässe", s.passes],
        ["Passquote", s.passes ? pct.format((s.passesCompleted ?? 0) / s.passes) : null],
        ["Schlüsselpässe", s.keyPasses],
        ["Zweikampfquote", s.duels ? pct.format((s.duelsWon ?? 0) / s.duels) : null],
        ["Dribblings (erfolgreich)", s.dribblesAttempted === null ? null : `${s.dribblesAttempted} (${s.dribblesSuccessful ?? 0})`],
        ["Ballverluste", s.dispossessed],
        ["Fouls", s.foulsCommitted],
        ["Karten", cardText(s.yellowCards, s.redCards)],
        ["Note", s.rating === null ? null : de1.format(s.rating)],
      ];
  return (
    <details className="group rounded-lg border px-3 py-2 open:bg-muted/30">
      <summary className="flex cursor-pointer list-none items-center gap-3">
        <span
          className={cn(
            "flex size-7 shrink-0 items-center justify-center rounded-md text-xs font-bold ring-1",
            outcome === "S" && "bg-status-ok/15 text-status-ok ring-status-ok/40",
            outcome === "U" && "bg-muted text-foreground ring-border",
            outcome === "N" && "bg-status-danger/15 text-status-danger ring-status-danger/40",
          )}
          aria-label={outcome === "S" ? "Sieg" : outcome === "N" ? "Niederlage" : outcome === "U" ? "Unentschieden" : "Kein Ergebnis"}
        >
          {outcome ?? "–"}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium">
            {game.isHome ? "vs." : "@"} {game.opponent}
            {game.result && <span className="ml-2 text-muted-foreground">{game.result.own}:{game.result.opp}</span>}
          </span>
          <span className="block text-xs text-muted-foreground">
            {dateLong(game.kickoffAt)} · {game.competition.name}
          </span>
        </span>
        <span className="text-right">
          <span className="block text-lg font-semibold tabular-nums">{s.rating === null ? "–" : de1.format(s.rating)}</span>
          <span className="block text-xs text-muted-foreground">{s.minutes}′</span>
        </span>
      </summary>
      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 border-t pt-3 text-sm sm:grid-cols-3">
        {field.map(([label, value]) => (
          <div key={label}>
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd className="tabular-nums">
              {value === null ? "–" : <Sourced source={game.source} label={label}>{value}</Sourced>}
            </dd>
          </div>
        ))}
      </dl>
    </details>
  );
}

function cardText(yellow: number | null, red: number | null) {
  if (yellow === null && red === null) return null;
  const parts = [];
  if (yellow) parts.push(`${yellow}× Gelb`);
  if (red) parts.push(`${red}× Rot`);
  return parts.length ? parts.join(", ") : "keine";
}

function ContractCard({ contract, now }: { contract: NonNullable<PlayerPageData["contract"]>; now: Date }) {
  const expired = contract.endDate !== null && new Date(`${contract.endDate}T23:59:59Z`) < now;
  const months = contract.endDate && !expired ? monthsBetween(now, contract.endDate) : null;
  const expiring = months !== null && months < 12;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileSignature className="size-4" aria-hidden /> Vertrag und Marktwert
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-muted-foreground">Restlaufzeit</p>
            <p className="text-2xl font-semibold tabular-nums">
              {expired ? "abgelaufen" : months === null ? "–" : <Sourced source={contract.source} label="Restlaufzeit">{months} Mon.</Sourced>}
            </p>
            {contract.endDate && <p className="text-xs text-muted-foreground">{expired ? "seit" : "bis"} {dateLong(contract.endDate)}</p>}
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Marktwert</p>
            <p className="text-2xl font-semibold tabular-nums">
              {contract.marketValueEur === null ? "–" : <Sourced source={contract.source} label="Marktwert">{eur.format(contract.marketValueEur)}</Sourced>}
            </p>
            <p className="text-xs text-muted-foreground">Trend: noch zu wenig Verlauf</p>
          </div>
        </div>
        {expired && <TrafficPill traffic="danger">Vertrag ausgelaufen – Daten prüfen</TrafficPill>}
        {expiring && (
          <TrafficPill traffic="warn">⚠ Vertrag läuft in unter 12 Monaten aus</TrafficPill>
        )}
      </CardContent>
    </Card>
  );
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}
