import { LifeBuoy } from "lucide-react";
import { confirmAge } from "@/lib/age-gate";

/**
 * Dauerhafter Hinweis im Quotenbereich (Abschnitt 8). Stand der Angaben:
 * 13.10.2026, check-dein-spiel.de (betrieben vom BIÖG, früher BZgA).
 */
export function GamblingHelpNotice() {
  return (
    <aside aria-label="Hilfe bei Glücksspielproblemen" className="rounded-lg border border-border bg-muted/40 px-3 py-2.5 text-sm">
      <p className="flex items-start gap-2">
        <LifeBuoy className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
        <span>
          Glücksspiel kann süchtig machen. Hilfe gibt es kostenlos und anonym beim Bundesinstitut für Öffentliche
          Gesundheit (BIÖG, früher BZgA): Telefon{" "}
          <a href="tel:08001372700" className="font-medium whitespace-nowrap underline">0800 1 37 27 00</a> oder{" "}
          <a href="https://www.check-dein-spiel.de" target="_blank" rel="noreferrer" className="font-medium underline">
            check-dein-spiel.de
          </a>
          . Spielen ab 18.
        </span>
      </p>
    </aside>
  );
}

/** Ehrliche Einordnung des Erwartungswerts (Abschnitt 6). */
export function ValueDisclaimer() {
  return (
    <p className="text-xs leading-relaxed text-muted-foreground">
      Der Erwartungswert ist eine Modellrechnung. Ein positiver Wert heißt nur, dass ein Anbieter vom Konsens der
      anderen abweicht – nicht, dass die Wette gewinnt. Buchmacher bleiben langfristig im Vorteil. Diese Seite
      enthält keine Affiliate-Links und keine Wettempfehlung.
    </p>
  );
}

/** Altersabfrage vor jedem Quoten- und Value-Bereich. */
export function AgeGate() {
  return (
    <section aria-labelledby="altersabfrage" className="space-y-4 rounded-xl border bg-card p-5">
      <h2 id="altersabfrage" className="text-xl font-semibold">Quoten nur ab 18 Jahren</h2>
      <p className="text-sm text-muted-foreground">
        Dieser Bereich zeigt Wettquoten. Statistik, News und alle anderen Seiten bleiben frei zugänglich.
      </p>
      <form action={confirmAge} className="space-y-3">
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" name="bestaetigung" value="ja" required className="mt-0.5 size-4 accent-[var(--primary)]" />
          Ich bin mindestens 18 Jahre alt.
        </label>
        <button type="submit" className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 focus-visible:outline-2 focus-visible:outline-ring">
          Weiter zu den Quoten
        </button>
      </form>
      <GamblingHelpNotice />
    </section>
  );
}
