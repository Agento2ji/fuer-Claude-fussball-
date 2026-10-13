import { ChevronRight, FlaskConical } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { AgeGate, GamblingHelpNotice, ValueDisclaimer } from "@/components/gambling-notice";
import { isAgeConfirmed } from "@/lib/age-gate-check";
import { kickoffText } from "@/lib/format";
import { marketLabel, selectionLabel } from "@/lib/odds/labels";
import { getValueOverview } from "@/lib/queries/odds";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Quoten", robots: { index: false } };

const pct1 = new Intl.NumberFormat("de-DE", { style: "percent", minimumFractionDigits: 1, maximumFractionDigits: 1 });

export default async function OddsOverviewPage() {
  const confirmed = await isAgeConfirmed();
  return (
    <main className="mx-auto max-w-2xl space-y-4 px-4 pt-4 pb-16">
      <h1 className="text-2xl font-semibold tracking-tight">Quoten</h1>
      {!confirmed ? <AgeGate /> : <Overview />}
    </main>
  );
}

async function Overview() {
  const rows = await getValueOverview();
  return (
    <>
      <GamblingHelpNotice />
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Keine kommenden Spiele mit Quoten. Echte Quoten gibt es erst mit einem Key für The Odds API.
        </p>
      ) : (
        <ul className="divide-y rounded-xl border bg-card">
          {rows.map((r) => (
            <li key={r.id}>
              <Link href={`/spiele/${r.id}/quoten`} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/50">
                <span className="min-w-0 flex-1">
                  <span className="block text-xs text-muted-foreground">
                    {r.isTestData && <FlaskConical className="mr-1 inline size-3 text-status-warn" aria-label="Testdaten" />}
                    {r.competition} · {kickoffText(r.kickoffAt, r.kickoffTimeKnown)}
                  </span>
                  <span className="block truncate">{r.homeName} – {r.awayName}</span>
                  <span className="block text-xs text-muted-foreground">
                    {r.best
                      ? `${r.valueCount} auffällige ${r.valueCount === 1 ? "Abweichung" : "Abweichungen"} · stärkste: ${selectionLabel(r.best.market, r.best.selection, r.best.line, r.homeName, r.awayName)} (${marketLabel(r.best.market, r.best.line)}), EV ${pct1.format(r.best.ev!)}`
                      : "Keine Abweichung über 2 % EV"}
                  </span>
                </span>
                <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      )}
      <ValueDisclaimer />
    </>
  );
}
