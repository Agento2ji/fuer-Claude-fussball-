import { Ban, CircleCheck, HeartPulse, TriangleAlert } from "lucide-react";
import type { PlayerStatusKind, Traffic } from "@/lib/player-status";
import { cn } from "@/lib/utils";

const TRAFFIC_CLASSES: Record<Traffic, string> = {
  ok: "bg-status-ok/15 text-status-ok ring-status-ok/40",
  warn: "bg-status-warn/15 text-status-warn ring-status-warn/40",
  danger: "bg-status-danger/15 text-status-danger ring-status-danger/40",
};

function StatusIcon({ kind }: { kind: PlayerStatusKind }) {
  const cls = "size-5 shrink-0";
  if (kind === "einsatzbereit") return <CircleCheck className={cls} aria-hidden />;
  if (kind === "verletzt") return <HeartPulse className={cls} aria-hidden />;
  if (kind === "angeschlagen") return <TriangleAlert className={cls} aria-hidden />;
  return <Ban className={cls} aria-hidden />;
}

/** Status ganz oben auf der Spielerseite: Farbe plus Symbol plus Text. */
export function StatusBadge({
  kind,
  label,
  traffic,
  detail,
}: {
  kind: PlayerStatusKind;
  label: string;
  traffic: Traffic;
  detail?: string;
}) {
  return (
    <div
      role="status"
      className={cn("flex items-center gap-3 rounded-xl px-4 py-3 ring-1", TRAFFIC_CLASSES[traffic])}
    >
      <StatusIcon kind={kind} />
      <div className="min-w-0">
        <p className="text-lg font-semibold leading-tight">{label}</p>
        {detail && <p className="text-sm">{detail}</p>}
      </div>
    </div>
  );
}

export function TrafficPill({ traffic, children }: { traffic: Traffic; children: React.ReactNode }) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1", TRAFFIC_CLASSES[traffic])}>
      {children}
    </span>
  );
}
