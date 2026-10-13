import { cn } from "@/lib/utils";

const LABEL = { S: "Sieg", U: "Unentschieden", N: "Niederlage" } as const;

/** Ergebnis-Kürzel mit Farbe und Buchstabe – nie Farbe allein. */
export function FormChip({ outcome, size = "md" }: { outcome: "S" | "U" | "N" | null; size?: "sm" | "md" }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-md font-bold ring-1",
        size === "sm" ? "size-5 text-[10px]" : "size-7 text-xs",
        outcome === "S" && "bg-status-ok/15 text-status-ok ring-status-ok/40",
        outcome === "U" && "bg-muted text-foreground ring-border",
        outcome === "N" && "bg-status-danger/15 text-status-danger ring-status-danger/40",
        outcome === null && "bg-muted text-muted-foreground ring-border",
      )}
      title={outcome ? LABEL[outcome] : "Kein Ergebnis"}
      aria-label={outcome ? LABEL[outcome] : "Kein Ergebnis"}
    >
      {outcome ?? "–"}
    </span>
  );
}
