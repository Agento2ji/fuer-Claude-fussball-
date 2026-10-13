"use client";

import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export interface SeasonPoint {
  label: string;
  opponent: string;
  rating: number | null;
  scorer: number;
  minutes: number;
}

/**
 * Saisonverlauf: Note je Spiel als Balken, Scorerpunkte als Linie.
 * Spiele in zeitlicher Reihenfolge, älteste links.
 */
export function SeasonChart({ points }: { points: SeasonPoint[] }) {
  if (points.length < 2) {
    return <p className="text-sm text-muted-foreground">Zu wenige Spiele für einen Verlauf.</p>;
  }
  return (
    <div className="h-52 w-full" role="img" aria-label={`Saisonverlauf über ${points.length} Spiele: Note und Scorerpunkte je Spiel`}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={points} margin={{ top: 8, right: 4, bottom: 0, left: -24 }}>
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} />
          <YAxis yAxisId="rating" domain={[4, 10]} ticks={[4, 6, 8, 10]} tickLine={false} axisLine={false} tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} />
          <YAxis yAxisId="scorer" orientation="right" hide domain={[0, "dataMax + 1"]} />
          <Tooltip
            cursor={{ fill: "var(--muted)", opacity: 0.4 }}
            contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12, color: "var(--popover-foreground)" }}
            labelFormatter={(_, payload) => {
              const p = payload?.[0]?.payload as SeasonPoint | undefined;
              return p ? `${p.label} gegen ${p.opponent} (${p.minutes} Min.)` : "";
            }}
            formatter={(value, name) => [
              name === "rating" ? Number(value).toFixed(1) : String(value),
              name === "rating" ? "Note" : "Scorerpunkte",
            ]}
          />
          <Bar yAxisId="rating" dataKey="rating" name="rating" fill="var(--chart-2)" radius={[4, 4, 0, 0]} maxBarSize={28} />
          <Line yAxisId="scorer" dataKey="scorer" name="scorer" stroke="var(--chart-1)" strokeWidth={2} dot={{ r: 3, fill: "var(--chart-1)" }} type="monotone" />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
