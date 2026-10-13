import { Ban, ExternalLink, FlaskConical, HeartPulse, Tv, TriangleAlert } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Countdown } from "@/components/countdown";
import { FormChip } from "@/components/form-chip";
import { Lineup } from "@/components/lineup";
import { SourceFootnote, Sourced } from "@/components/source-note";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { dateLong, kickoffText } from "@/lib/format";
import { getMatchPage, type MatchPageData } from "@/lib/queries/match";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const data = Number.isInteger(Number(id)) ? await getMatchPage(Number(id)) : null;
  return {
    title: data ? `${data.home.name} – ${data.away.name}` : "Spiel",
    description: data ? `${data.home.name} gegen ${data.away.name}: Anstoß, Übertragung, Form, Ausfälle und Aufstellungen.` : undefined,
  };
}

export default async function MatchPage({ params }: Props) {
  const { id } = await params;
  const matchId = Number(id);
  if (!Number.isInteger(matchId)) notFound();
  const data = await getMatchPage(matchId);
  if (!data) notFound();
  const now = new Date();
  const { match, competition, home, away } = data;
  const finished = match.homeScore !== null && match.awayScore !== null;
  const upcoming = !finished && match.kickoffAt > now;

  return (
    <main className="mx-auto max-w-2xl space-y-4 px-4 pt-4 pb-16">
      {competition.isTestData && (
        <div className="flex items-start gap-2 rounded-lg border border-status-warn/40 bg-status-warn/10 px-3 py-2 text-sm text-status-warn">
          <FlaskConical className="mt-0.5 size-4 shrink-0" aria-hidden />
          <p><strong>Testdaten.</strong> Spiel, Vereine und Spieler sind erfunden.</p>
        </div>
      )}

      {/* Kopf: Paarung, Ergebnis oder Anstoß */}
      <section aria-labelledby="paarung" className="space-y-3">
        <p className="text-sm text-muted-foreground">
          <Link href={`/wettbewerbe/${competition.code}`} className="hover:text-foreground">{competition.name}</Link>
          {match.matchday && ` · ${match.matchday}. Spieltag`}
        </p>
        <h1 id="paarung" className="sr-only">{home.name} gegen {away.name}</h1>
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
          <TeamHead side={home} tableSize={data.tableSize} align="left" />
          <div className="text-center">
            {finished ? (
              <Sourced source={data.source} label="Ergebnis" className="no-underline">
                <span className="text-3xl font-semibold tabular-nums">{match.homeScore}:{match.awayScore}</span>
              </Sourced>
            ) : (
              <span className="text-lg text-muted-foreground">–:–</span>
            )}
          </div>
          <TeamHead side={away} tableSize={data.tableSize} align="right" />
        </div>
        <p className="text-center text-sm text-muted-foreground">
          {kickoffText(match.kickoffAt, match.kickoffTimeKnown)}
          {match.venue && ` · ${match.venue}`}
        </p>
        {upcoming && match.kickoffTimeKnown && (
          <Countdown kickoffAt={match.kickoffAt.toISOString()} serverNow={now.toISOString()} />
        )}
        {!finished && !upcoming && (
          <p className="flex items-center justify-center gap-2 text-sm text-status-warn">
            <TriangleAlert className="size-4" aria-hidden /> Anstoß ist vorbei, die Quelle hat noch kein Ergebnis.
          </p>
        )}
      </section>

      <BroadcastCard data={data} />

      {!finished && (
        <Link href={`/spiele/${match.id}/quoten`} className="flex items-center justify-between rounded-xl border bg-card px-4 py-3 text-sm hover:bg-muted/50">
          <span>
            <span className="block font-medium">Quotenvergleich</span>
            <span className="block text-xs text-muted-foreground">Ab 18 · Tipico und Winamax im Vergleich</span>
          </span>
          <span aria-hidden>›</span>
        </Link>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Form</CardTitle>
          <p className="text-sm text-muted-foreground">Letzte 5 Pflichtspiele vor diesem Spiel, neuestes links</p>
        </CardHeader>
        <CardContent className="space-y-2">
          {[home, away].map((t) => (
            <div key={t.id} className="flex items-center justify-between gap-3">
              <span className="truncate text-sm">{t.name}</span>
              <span className="flex gap-1">
                {t.form.length === 0 ? <span className="text-xs text-muted-foreground">keine Daten</span> : t.form.map((f) => <FormChip key={f.id} outcome={f.outcome} size="sm" />)}
              </span>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Ausfälle und Form-Badges beschreiben den heutigen Stand – nur vor dem Spiel sinnvoll. */}
      {!finished && <AbsencesCard data={data} />}

      {(home.lineup || away.lineup) ? (
        <Card>
          <CardHeader>
            <CardTitle>Aufstellungen</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {[home, away].map((t) => (
              <div key={t.id}>
                <h2 className="mb-2 font-medium">{t.name}</h2>
                {t.lineup ? (
                  <Lineup lineup={t.lineup} forms={finished ? new Map() : data.forms} showForm={!finished} />
                ) : (
                  <p className="text-sm text-muted-foreground">Noch keine Aufstellung gemeldet.</p>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Aufstellungen</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Noch keine Aufstellung gemeldet. Ohne API-Key gibt es Aufstellungen nur in den Testdaten.
            </p>
          </CardContent>
        </Card>
      )}

      <HeadToHeadCard data={data} />

      <SourceFootnote source={data.source} />
    </main>
  );
}

function TeamHead({ side, tableSize, align }: { side: MatchPageData["home"]; tableSize: number; align: "left" | "right" }) {
  return (
    <Link href={`/teams/${side.id}`} className={cn("min-w-0 hover:text-primary", align === "right" && "text-right")}>
      <span className="block text-lg leading-tight font-semibold">{side.name}</span>
      {side.position && <span className="block text-xs text-muted-foreground">Platz {side.position} von {tableSize}</span>}
    </Link>
  );
}

function BroadcastCard({ data }: { data: MatchPageData }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Tv className="size-4" aria-hidden /> Übertragung in Deutschland</CardTitle>
      </CardHeader>
      <CardContent>
        {data.broadcasts.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Für dieses Spiel liegt keine geprüfte Senderangabe vor. Wir zeigen hier nur Angaben aus
            zulässigen Quellen, keine Vermutung nach Sendeplatz.
          </p>
        ) : (
          <ul className="space-y-2">
            {data.broadcasts.map((b) => (
              <li key={b.id} className="flex items-center justify-between gap-3">
                <span>
                  <Sourced source={b.source} label="Sender">{b.broadcaster}</Sourced>
                  <span className="ml-2 text-xs text-muted-foreground">{b.isPaid ? "kostenpflichtig" : "frei empfangbar"}</span>
                </span>
                {b.url && (
                  <a href={b.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
                    Zum Sender <ExternalLink className="size-3.5" aria-hidden />
                  </a>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function AbsencesCard({ data }: { data: MatchPageData }) {
  const sides = [data.home, data.away];
  const noData = sides.every((s) => s.availability.squad.length === 0);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Ausfälle</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {noData ? (
          <p className="text-sm text-muted-foreground">Keine Kaderdaten vorhanden; Ausfälle gibt es ohne API-Key nur in den Testdaten.</p>
        ) : (
          sides.map((s) => (
            <div key={s.id}>
              <h2 className="mb-1.5 text-sm font-medium">{s.name}</h2>
              {s.availability.absences.length === 0 && s.availability.atRisk.length === 0 ? (
                <p className="text-sm text-muted-foreground">Keine Ausfälle gemeldet.</p>
              ) : (
                <ul className="space-y-1.5 text-sm">
                  {s.availability.absences.map((a) => (
                    <li key={`${a.kind}-${a.player.id}`} className="flex items-center gap-2">
                      {a.kind === "gesperrt" ? (
                        <Ban className="size-4 shrink-0 text-status-danger" aria-hidden />
                      ) : (
                        <HeartPulse className={cn("size-4 shrink-0", a.kind === "angeschlagen" ? "text-status-warn" : "text-status-danger")} aria-hidden />
                      )}
                      <Link href={`/spieler/${a.player.id}`} className="font-medium hover:text-primary">{a.player.name}</Link>
                      <span className="truncate text-muted-foreground">
                        <Sourced source={a.source} label={`Status ${a.player.name}`}>
                          {a.kind === "gesperrt" ? "gesperrt" : a.kind === "verletzt" ? "verletzt" : "angeschlagen"}
                        </Sourced>
                        {a.expectedReturn && ` · bis ${dateLong(a.expectedReturn)}`}
                      </span>
                    </li>
                  ))}
                  {s.availability.atRisk.map((r) => (
                    <li key={`risk-${r.player.id}`} className="flex items-center gap-2">
                      <TriangleAlert className="size-4 shrink-0 text-status-warn" aria-hidden />
                      <Link href={`/spieler/${r.player.id}`} className="font-medium hover:text-primary">{r.player.name}</Link>
                      <span className="text-muted-foreground">sperrgefährdet ({r.count} Gelbe)</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

function HeadToHeadCard({ data }: { data: MatchPageData }) {
  const { h2h, duels, home, away } = data;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Direkter Vergleich</CardTitle>
        {h2h.played > 0 && (
          <p className="text-sm text-muted-foreground">
            {h2h.played} erfasste {h2h.played === 1 ? "Duell" : "Duelle"} · {home.name}: {h2h.wins}{" "}
            {h2h.wins === 1 ? "Sieg" : "Siege"}, {h2h.draws} Remis, {h2h.losses}{" "}
            {h2h.losses === 1 ? "Niederlage" : "Niederlagen"} · Tore {h2h.goalsFor}:{h2h.goalsAgainst}
          </p>
        )}
      </CardHeader>
      <CardContent>
        {duels.length === 0 ? (
          <p className="text-sm text-muted-foreground">Keine früheren Duelle in den erfassten Daten.</p>
        ) : (
          <>
            <div className="mb-3 flex h-2 overflow-hidden rounded-full" aria-hidden>
              <span className="bg-status-ok" style={{ width: `${(h2h.wins / h2h.played) * 100}%` }} />
              <span className="bg-muted-foreground/40" style={{ width: `${(h2h.draws / h2h.played) * 100}%` }} />
              <span className="bg-status-danger" style={{ width: `${(h2h.losses / h2h.played) * 100}%` }} />
            </div>
            <ul className="divide-y text-sm">
              {duels.slice(0, 6).map((d) => (
                <li key={d.id} className="py-1.5">
                  <Link href={`/spiele/${d.id}`} className="block hover:text-primary">
                    <span className="block text-xs text-muted-foreground">{dateLong(d.kickoffAt)} · {d.competitionName}</span>
                    <span className="block">
                      {d.homeTeamId === home.id ? home.name : away.name}{" "}
                      <span className="font-semibold tabular-nums">{d.homeScore}:{d.awayScore}</span>{" "}
                      {d.awayTeamId === away.id ? away.name : home.name}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}
      </CardContent>
    </Card>
  );
}
