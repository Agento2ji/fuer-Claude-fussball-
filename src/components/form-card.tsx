import { ArrowDown, ArrowUp, CircleHelp, TriangleAlert } from "lucide-react";
import { FORM_TIERS, FORM_WINDOW, type FormTierKey, LEAGUE_SHIFT_SD, METRIC_LABEL, SHORT_CAREER_WINDOWS } from "@/config/form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { dateLong } from "@/lib/format";
import type { FormResult } from "@/lib/form";
import { cn } from "@/lib/utils";

const TIER_CLASSES: Record<FormTierKey, string> = {
  schlecht: "bg-status-danger/15 text-status-danger ring-status-danger/40",
  mittel: "bg-muted text-foreground ring-border",
  gut: "bg-status-ok/15 text-status-ok ring-status-ok/40",
  bestform: "bg-primary/20 text-primary ring-primary/50",
};

const pctFmt = new Intl.NumberFormat("de-DE", { maximumFractionDigits: 0 });

/** Kompaktes Form-Badge, z. B. in Kaderlisten. Immer Text, nie nur Farbe. */
export function FormBadge({ form }: { form: FormResult | undefined }) {
  if (!form || form.status !== "ok") {
    return <span className="text-xs text-muted-foreground">Form: –</span>;
  }
  const short = { schlecht: "schlecht", mittel: "mittel", gut: "gut", bestform: "Bestform" }[form.tier];
  return (
    <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1", TIER_CLASSES[form.tier])}>
      {short}
      <span className="sr-only">, Perzentil {pctFmt.format(form.percentile)}</span>
    </span>
  );
}

export function FormCard({ form }: { form: FormResult | null }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-2">
        <CardTitle>Formbewertung</CardTitle>
        <Explanation form={form} />
      </CardHeader>
      <CardContent className="space-y-3">
        {!form ? (
          <p className="text-sm text-muted-foreground">Keine Spieldaten vorhanden.</p>
        ) : form.status === "zu-wenig-daten" ? (
          <div>
            <p className="text-lg font-semibold">Zu wenig Daten</p>
            <p className="text-sm text-muted-foreground">{form.reason}</p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between gap-3">
              <span className={cn("rounded-lg px-3 py-1.5 text-lg font-semibold ring-1", TIER_CLASSES[form.tier])}>
                {form.tierLabel}
              </span>
              <span className="text-right">
                <span className="block text-2xl font-semibold tabular-nums">{pctFmt.format(form.percentile)}</span>
                <span className="block text-xs text-muted-foreground">Perzentil der Karriere</span>
              </span>
            </div>
            <PercentileBar percentile={form.percentile} />
            <p className="text-sm text-muted-foreground">
              Aus {form.matchesUsed.length} Spielen seit {dateLong(form.matchesUsed[0]!.kickoffAt)}, verglichen mit{" "}
              {form.careerWindows} gleich langen Abschnitten seiner erfassten Karriere.
            </p>
            {form.drivers.length > 0 && (
              <div>
                <p className="mb-1 text-xs text-muted-foreground">Stärkste Einflüsse, gemessen an seiner Positionsgruppe</p>
                <ul className="space-y-1">
                  {form.drivers.map((d) => (
                    <li key={d.metric} className="flex items-center gap-2 text-sm">
                      {d.contribution >= 0 ? (
                        <ArrowUp className="size-4 text-status-ok" aria-label="über dem Schnitt" />
                      ) : (
                        <ArrowDown className="size-4 text-status-danger" aria-label="unter dem Schnitt" />
                      )}
                      {METRIC_LABEL[d.metric]}
                      <span className="text-muted-foreground">
                        {d.metric === "errorsLeadingToGoal"
                          ? d.contribution >= 0 ? "seltener als üblich" : "häufiger als üblich"
                          : d.contribution >= 0 ? "über dem Schnitt" : "unter dem Schnitt"}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {form.shortCareer && (
              <p className="flex items-start gap-2 rounded-md bg-status-warn/10 px-3 py-2 text-sm text-status-warn">
                <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
                Kurze erfasste Karriere ({form.careerWindows} Vergleichsabschnitte). „Bestform der Karriere“ hat
                hier wenig Aussagekraft.
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function PercentileBar({ percentile }: { percentile: number }) {
  return (
    <div aria-hidden className="relative h-2 rounded-full bg-muted">
      {FORM_TIERS.slice(0, -1).map((t) => (
        <span key={t.key} className="absolute top-0 h-2 w-px bg-background" style={{ left: `${t.upTo}%` }} />
      ))}
      <span
        className="absolute top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-foreground ring-2 ring-background"
        style={{ left: `${Math.min(100, Math.max(0, percentile))}%` }}
      />
    </div>
  );
}

function Explanation({ form }: { form: FormResult | null }) {
  return (
    <Popover>
      <PopoverTrigger className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground">
        <CircleHelp className="size-3.5" aria-hidden />
        Wie entsteht das?
      </PopoverTrigger>
      <PopoverContent className="w-80 text-xs leading-relaxed" align="end">
        <p className="font-medium">So wird gerechnet – keine Bauchentscheidung:</p>
        <ol className="list-decimal space-y-1 pl-4">
          <li>Je Spiel werden die wichtigsten Kennzahlen seiner Position auf 90 Minuten umgerechnet.</li>
          <li>
            Jede Kennzahl wird mit allen Spielern derselben Position im selben Wettbewerb und derselben Saison
            verglichen (Standardabweichungen über oder unter dem Schnitt). Stärkere Ligen zählen etwas mehr
            (± {LEAGUE_SHIFT_SD} × Ligastärke).
          </li>
          <li>Gewichtet ergibt das einen Wert pro Spiel.</li>
          <li>
            Aktuelle Form = Mittel der letzten {FORM_WINDOW.matches} Pflichtspiele mit mindestens{" "}
            {FORM_WINDOW.minMinutes} Minuten (aus den letzten {FORM_WINDOW.maxAgeDays} Tagen, mindestens{" "}
            {FORM_WINDOW.minMatches}).
          </li>
          <li>
            Dieser Wert wird mit allen gleich langen Abschnitten seiner erfassten Karriere verglichen: unter 25 % =
            schlecht, 25–60 % mittel, 60–90 % gut, über 90 % Bestform.
          </li>
        </ol>
        {form?.status === "ok" && (
          <p className="mt-2 text-muted-foreground">
            Unter {SHORT_CAREER_WINDOWS} Vergleichsabschnitten weisen wir auf eine kurze Karriere hin.
          </p>
        )}
      </PopoverContent>
    </Popover>
  );
}
