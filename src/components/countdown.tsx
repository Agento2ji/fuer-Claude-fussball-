"use client";

import { useEffect, useState } from "react";
import { countdownParts } from "@/lib/match";

/**
 * Countdown bis Anstoß. Der Server rendert den Stand zum Abrufzeitpunkt,
 * der Client zählt danach jede Sekunde weiter.
 */
export function Countdown({ kickoffAt, serverNow }: { kickoffAt: string; serverNow: string }) {
  const [now, setNow] = useState(() => new Date(serverNow));
  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  const p = countdownParts(new Date(kickoffAt), now);
  if (p.started) return <p className="text-sm text-muted-foreground">Anstoß ist erfolgt.</p>;
  const units: [number, string][] = [
    [p.days, p.days === 1 ? "Tag" : "Tage"],
    [p.hours, "Std."],
    [p.minutes, "Min."],
    [p.seconds, "Sek."],
  ];
  return (
    <div className="grid grid-cols-4 gap-2" role="timer" aria-label={`Anstoß in ${p.days} Tagen, ${p.hours} Stunden, ${p.minutes} Minuten`}>
      {units.map(([v, label]) => (
        <div key={label} className="rounded-lg bg-muted/50 py-2 text-center">
          <span className="block text-2xl font-semibold tabular-nums" aria-hidden>
            {String(v).padStart(2, "0")}
          </span>
          <span className="block text-xs text-muted-foreground" aria-hidden>
            {label}
          </span>
        </div>
      ))}
    </div>
  );
}
