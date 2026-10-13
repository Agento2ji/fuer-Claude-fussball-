import { Clock, ShieldCheck, Star } from "lucide-react";
import { BOOKMAKERS, GGL_WHITELIST_URL, isComparable } from "@/config/bookmakers";
import { MIN_EV, RISK_LEVELS, STALE_MINUTES } from "@/config/value";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { dateLong } from "@/lib/format";
import { DEVIG_LABEL, type DevigMethod } from "@/lib/odds/devig";
import { marketLabel, selectionLabel } from "@/lib/odds/labels";
import type { MarketAnalysis, ValueBet } from "@/lib/odds/value";
import { formatBerlin } from "@/lib/time";
import { cn } from "@/lib/utils";

const odds2 = new Intl.NumberFormat("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pct1 = new Intl.NumberFormat("de-DE", { style: "percent", minimumFractionDigits: 1, maximumFractionDigits: 1 });
const signedPct = (v: number) => (v > 0 ? "+" : "") + pct1.format(v);
const RISK_LABEL = Object.fromEntries(RISK_LEVELS.map((r) => [r.key, r.label])) as Record<string, string>;
const NAME = Object.fromEntries(BOOKMAKERS.map((b) => [b.key, b.name])) as Record<string, string>;
const COMPARABLE = BOOKMAKERS.filter(isComparable);

export function ValueBetCards({ bets, home, away }: { bets: ValueBet[]; home: string; away: string }) {
  if (bets.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Keine Wette erreicht mindestens {pct1.format(MIN_EV)} Erwartungswert. Die Quoten der Anbieter weichen hier kaum vom
        Konsens ab.
      </p>
    );
  }
  return (
    <ol className="space-y-3">
      {bets.map((b, i) => (
        <li key={`${b.market}-${b.line}-${b.selection}`} className="rounded-lg border p-3">
          <p className="text-xs text-muted-foreground">
            {i + 1}. · {marketLabel(b.market, b.line)}
          </p>
          <p className="font-medium">{selectionLabel(b.market, b.selection, b.line, home, away)}</p>
          <dl className="mt-2 grid grid-cols-3 gap-x-3 gap-y-2 text-sm">
            <Fact label={`Quote bei ${NAME[b.best!.bookmakerKey]}`} value={odds2.format(b.best!.price)} strong />
            <Fact label="Faire Quote" value={odds2.format(b.fairOdds)} />
            <Fact label="Erwartungswert" value={signedPct(b.ev!)} strong />
            <Fact label="Kelly (¼)" value={pct1.format(b.kellyShown!)} />
            <Fact label="Risiko" value={RISK_LABEL[b.risk!]!} />
            <Fact label="Faire Wahrsch." value={pct1.format(b.fairProbability)} />
          </dl>
          <p className={cn("mt-2 flex items-center gap-1 text-xs", b.stale ? "text-status-warn" : "text-muted-foreground")}>
            <Clock className="size-3" aria-hidden />
            Quote von {formatBerlin(b.best!.fetchedAt, { dateStyle: "short", timeStyle: "short" })}
            {b.stale && ` – veraltet (älter als ${STALE_MINUTES} Minuten)`}
          </p>
        </li>
      ))}
    </ol>
  );
}

function Fact({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className={cn("tabular-nums", strong && "font-semibold")}>{value}</dd>
    </div>
  );
}

export function MarketTable({ market, home, away }: { market: MarketAnalysis; home: string; away: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{marketLabel(market.market, market.line)}</CardTitle>
        <p className="text-xs text-muted-foreground">
          Marge:{" "}
          {COMPARABLE.filter((b) => b.key in market.margins)
            .map((b) => `${b.name} ${pct1.format(market.margins[b.key]!)}`)
            .join(" · ")}
        </p>
      </CardHeader>
      <CardContent className="px-0 sm:px-4">
        <table className="w-full text-sm">
          <caption className="sr-only">Quotenvergleich {marketLabel(market.market, market.line)}</caption>
          <thead>
            <tr className="text-xs text-muted-foreground">
              <th scope="col" className="py-1.5 pl-4 text-left font-normal sm:pl-0">Tipp</th>
              {COMPARABLE.map((b) => (
                <th key={b.key} scope="col" className="w-16 py-1.5 text-right font-normal">{b.name}</th>
              ))}
              <th scope="col" className="w-14 py-1.5 text-right font-normal">Fair</th>
              <th scope="col" className="w-16 py-1.5 pr-4 text-right font-normal sm:pr-0">EV</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {market.selections.map((s) => (
              <tr key={s.selection}>
                <th scope="row" className="py-2 pl-4 text-left font-normal sm:pl-0">
                  {selectionLabel(market.market, s.selection, market.line, home, away)}
                </th>
                {COMPARABLE.map((b) => {
                  const p = s.prices.find((x) => x.bookmakerKey === b.key);
                  return (
                    <td key={b.key} className={cn("py-2 text-right tabular-nums", p?.isBest && "font-semibold text-primary")}>
                      {p ? (
                        <>
                          {p.isBest && <Star className="mr-0.5 inline size-3 fill-current" aria-label="beste Quote" />}
                          {odds2.format(p.price)}
                        </>
                      ) : (
                        <span className="text-muted-foreground">–</span>
                      )}
                    </td>
                  );
                })}
                <td className="py-2 text-right tabular-nums text-muted-foreground">{odds2.format(s.fairOdds)}</td>
                <td className={cn("py-2 pr-4 text-right tabular-nums sm:pr-0", s.ev !== null && s.ev >= MIN_EV && "font-semibold text-status-ok")}>
                  {s.ev === null ? "–" : signedPct(s.ev)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <details className="mt-3 px-4 text-xs sm:px-0">
          <summary className="cursor-pointer text-muted-foreground hover:text-foreground">Methoden im Vergleich</summary>
          <table className="mt-2 w-full">
            <thead>
              <tr className="text-muted-foreground">
                <th className="text-left font-normal">Faire Wahrscheinlichkeit</th>
                {(Object.keys(DEVIG_LABEL) as DevigMethod[]).map((m) => (
                  <th key={m} className="text-right font-normal">{DEVIG_LABEL[m]}{m === "power" && "*"}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {market.selections.map((s) => (
                <tr key={s.selection}>
                  <td>{selectionLabel(market.market, s.selection, market.line, home, away)}</td>
                  {(Object.keys(DEVIG_LABEL) as DevigMethod[]).map((m) => (
                    <td key={m} className="text-right tabular-nums">{pct1.format(s.byMethod[m])}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-1 text-muted-foreground">
            * Hauptmethode. Konsens aus {market.consensusSize} Anbietern, gewichtet nach 1 / Marge; dazu zählt ein
            internationaler Referenzmarkt ohne deutsche Erlaubnis, der hier nicht angezeigt wird.
          </p>
        </details>
      </CardContent>
    </Card>
  );
}

export function LicenseCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldCheck className="size-4" aria-hidden /> Angezeigte Anbieter
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        {COMPARABLE.map((b) => (
          <p key={b.key}>
            <span className="font-medium">{b.name}</span>{" "}
            <span className="text-muted-foreground">
              · {b.ggl!.operator} · deutsche Erlaubnis für Sportwetten seit {dateLong(b.ggl!.firstPermission)}
              {b.ggl!.followUpPermission && `, Folgeerlaubnis ${dateLong(b.ggl!.followUpPermission)}`}
            </span>
          </p>
        ))}
        <p className="text-xs text-muted-foreground">
          Geprüft am {dateLong(COMPARABLE[0]!.ggl!.checkedAt)} auf der{" "}
          <a href={GGL_WHITELIST_URL} target="_blank" rel="noreferrer" className="underline">
            amtlichen Whitelist der Gemeinsamen Glücksspielbehörde der Länder
          </a>
          . Die Behörde veröffentlicht keine Erlaubnisnummern. Keine Affiliate-Links.
        </p>
      </CardContent>
    </Card>
  );
}
