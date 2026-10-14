import { ArrowRight, FlaskConical } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { AgeGate, GamblingHelpNotice, ValueDisclaimer } from "@/components/gambling-notice";
import { AbroadHintList, ValueTipCard } from "@/components/odds-view";
import { RISK_LEVELS } from "@/config/value";
import { isAgeConfirmed } from "@/lib/age-gate-check";
import { applyBoardFilter, BOARD_MARKETS, BOARD_SORTS, type BoardFilter, boardHref, parseBoardFilter } from "@/lib/odds/board";
import { getValueBoard } from "@/lib/queries/odds";
import { formatBerlin } from "@/lib/time";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: { absolute: "Value-Tipps · Fußball-Hub" },
  description: "Wetten, deren beste Quote in Deutschland über der fairen Quote liegt – über alle kommenden Spiele.",
  robots: { index: false },
};

const SHOWN = 30;

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function ValuePage({ searchParams }: Props) {
  const confirmed = await isAgeConfirmed();
  const filter = parseBoardFilter(await searchParams);
  return (
    <main className="mx-auto max-w-2xl space-y-5 px-4 pt-5 pb-16">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Value-Tipps</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Wetten, bei denen die beste Quote bei Tipico oder Winamax über der fairen Quote liegt – berechnet aus dem
          Konsens aller Anbieter.
        </p>
      </div>
      {!confirmed ? <AgeGate /> : <Board filter={filter} />}
    </main>
  );
}

async function Board({ filter }: { filter: BoardFilter }) {
  const board = await getValueBoard();
  const tips = applyBoardFilter(board.tips, filter);
  const leagues = [...new Map(board.tips.map((t) => [t.match.competitionCode, t.match.competition])).entries()];
  const hints = board.hints
    .filter((h) => !filter.liga || h.match.competitionCode === filter.liga)
    .filter((h) => !filter.markt || h.hint.market === filter.markt)
    .slice(0, 10);

  return (
    <>
      <nav aria-label="Filter" className="space-y-2">
        <ChipRow label="Liga">
          <Chip href={boardHref(filter, { liga: null })} active={!filter.liga}>Alle</Chip>
          {leagues.map(([code, name]) => (
            <Chip key={code} href={boardHref(filter, { liga: code })} active={filter.liga === code}>{name}</Chip>
          ))}
        </ChipRow>
        <ChipRow label="Markt">
          <Chip href={boardHref(filter, { markt: null })} active={!filter.markt}>Alle</Chip>
          {BOARD_MARKETS.map((m) => (
            <Chip key={m.key} href={boardHref(filter, { markt: m.key })} active={filter.markt === m.key}>{m.label}</Chip>
          ))}
        </ChipRow>
        <ChipRow label="Risiko">
          <Chip href={boardHref(filter, { risiko: null })} active={!filter.risiko}>Alle</Chip>
          {RISK_LEVELS.slice(0, -1).map((r) => (
            <Chip key={r.key} href={boardHref(filter, { risiko: r.key })} active={filter.risiko === r.key}>
              bis {r.label}
            </Chip>
          ))}
        </ChipRow>
        <ChipRow label="Sortierung">
          {BOARD_SORTS.map((s) => (
            <Chip key={s.key} href={boardHref(filter, { sort: s.key })} active={filter.sort === s.key}>{s.label}</Chip>
          ))}
        </ChipRow>
      </nav>

      <p className="text-sm text-muted-foreground" aria-live="polite">
        {tips.length} {tips.length === 1 ? "Tipp" : "Tipps"} aus {board.matchCount} Spielen der nächsten {board.days} Tage
        {board.newestFetchedAt && ` · Quoten von ${formatBerlin(board.newestFetchedAt, { dateStyle: "short", timeStyle: "short" })}`}
        {board.tips.some((t) => t.match.isTestData) && (
          <span className="ml-1 inline-flex items-center gap-1 text-status-warn">
            · <FlaskConical className="size-3" aria-hidden /> enthält Testdaten
          </span>
        )}
      </p>

      {tips.length === 0 ? (
        <p className="rounded-xl border bg-card p-4 text-sm text-muted-foreground">
          {board.matchCount === 0
            ? "Keine kommenden Spiele mit Quoten. Quoten kommen einmal täglich gegen 06:17 Uhr."
            : "Mit diesen Filtern liegt keine Quote mindestens 2 % über dem fairen Preis."}
        </p>
      ) : (
        <ol className="space-y-3">
          {tips.slice(0, SHOWN).map((t, i) => (
            <ValueTipCard key={`${t.match.id}-${t.bet.market}-${t.bet.line}-${t.bet.selection}`} match={t.match} bet={t.bet} rank={i + 1} />
          ))}
        </ol>
      )}
      {tips.length > SHOWN && (
        <p className="text-xs text-muted-foreground">Gezeigt werden die {SHOWN} besten; mit den Filtern lässt sich eingrenzen.</p>
      )}

      {hints.length > 0 && (
        <section aria-labelledby="ausland" className="space-y-2">
          <h2 id="ausland" className="text-sm font-medium">Nur in Auslandsversionen über fair</h2>
          <p className="text-xs text-muted-foreground">
            Richtwerte von Betway, Betano und LeoVegas (UK-Seiten). Auf deren deutschen Seiten können die Quoten
            niedriger sein – vor dem Wetten dort prüfen.
          </p>
          <AbroadHintList items={hints} />
        </section>
      )}

      <Link href="/quoten" className="flex items-center gap-1 text-sm font-medium text-primary-ink hover:underline">
        Alle Spiele mit Quotenvergleich <ArrowRight className="size-4" aria-hidden />
      </Link>
      <ValueDisclaimer />
      <GamblingHelpNotice />
    </>
  );
}

function ChipRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-20 shrink-0 text-xs text-muted-foreground">{label}</span>
      <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5">{children}</div>
    </div>
  );
}

function Chip({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      aria-current={active ? "true" : undefined}
      className={cn(
        "shrink-0 rounded-full border px-3 py-1 text-xs whitespace-nowrap",
        active ? "border-primary bg-primary/15 font-medium text-primary-ink" : "text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </Link>
  );
}
