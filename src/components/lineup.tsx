import Link from "next/link";
import type { FormResult } from "@/lib/form";
import { FormBadge } from "./form-card";
import { SourceFootnote } from "./source-note";
import type { SourceInfo } from "./source-note";

interface LineupPlayer {
  id: number;
  name: string;
  position: "goalkeeper" | "defender" | "midfielder" | "forward" | null;
  shirtNumber: number | null;
}

const ROWS = [
  ["forward", "Sturm"],
  ["midfielder", "Mittelfeld"],
  ["defender", "Abwehr"],
  ["goalkeeper", "Tor"],
] as const;

/**
 * Aufstellung als Spielfeld-Reihen (Sturm oben, Tor unten), darunter die Bank.
 * Mit Form-Badge je Spieler.
 */
export function Lineup({
  lineup,
  forms,
  showForm = true,
}: {
  lineup: { isProbable: boolean; formation: string | null; source: SourceInfo; starters: LineupPlayer[]; bench: LineupPlayer[] };
  forms: Map<number, FormResult>;
  /** Form-Badges zeigen die heutige Form – bei vergangenen Spielen ausblenden. */
  showForm?: boolean;
}) {
  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        {lineup.isProbable ? "Voraussichtliche Aufstellung" : "Bestätigte Aufstellung"}
        {lineup.formation && ` · ${lineup.formation}`}
      </p>
      <div className="space-y-1.5 rounded-xl bg-status-ok/5 p-2 ring-1 ring-status-ok/20">
        {ROWS.map(([pos, label]) => {
          const row = lineup.starters.filter((p) => p.position === pos);
          if (row.length === 0) return null;
          return (
            <div key={pos}>
              <p className="sr-only">{label}</p>
              <ul className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${row.length}, minmax(0, 1fr))` }}>
                {row.map((p) => (
                  <li key={p.id}>
                    <Link href={`/spieler/${p.id}`} className="flex h-full flex-col items-center gap-1 rounded-lg bg-card px-1 py-1.5 text-center ring-1 ring-foreground/10 hover:ring-primary">
                      <span className="text-xs tabular-nums text-muted-foreground">{p.shirtNumber}</span>
                      <span className="line-clamp-2 text-xs leading-tight font-medium">{p.name.split(" ").slice(-1)[0]}</span>
                      {showForm && <FormBadge form={forms.get(p.id)} />}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
      {lineup.bench.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Eingewechselt: {lineup.bench.map((p) => p.name).join(", ")}
        </p>
      )}
      <SourceFootnote source={lineup.source} />
    </div>
  );
}
