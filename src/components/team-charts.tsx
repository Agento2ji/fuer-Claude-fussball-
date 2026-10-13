"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const axis = { tickLine: false, axisLine: false, tick: { fill: "var(--muted-foreground)", fontSize: 11 } } as const;
const tooltipStyle = {
  background: "var(--popover)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  fontSize: 12,
  color: "var(--popover-foreground)",
};
const de2 = new Intl.NumberFormat("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export interface XgPoint {
  label: string;
  opponent: string;
  xg: number;
  xga: number;
}

/** xG und xGA je Spiel nebeneinander, älteste links. */
export function XgChart({ points }: { points: XgPoint[] }) {
  return (
    <div className="h-48 w-full" role="img" aria-label={`xG und xGA in den letzten ${points.length} Spielen`}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={points} margin={{ top: 8, right: 4, bottom: 0, left: -24 }} barGap={2}>
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis dataKey="label" {...axis} />
          <YAxis {...axis} allowDecimals={false} />
          <Tooltip
            cursor={{ fill: "var(--muted)", opacity: 0.4 }}
            contentStyle={tooltipStyle}
            labelFormatter={(_, p) => {
              const x = p?.[0]?.payload as XgPoint | undefined;
              return x ? `${x.label} gegen ${x.opponent}` : "";
            }}
            formatter={(v, name) => [de2.format(Number(v)), name === "xg" ? "xG" : "xGA"]}
          />
          <Bar dataKey="xg" name="xg" fill="var(--chart-1)" radius={[3, 3, 0, 0]} maxBarSize={18} />
          <Bar dataKey="xga" name="xga" fill="var(--chart-2)" radius={[3, 3, 0, 0]} maxBarSize={18} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Tore nach Spielabschnitten. */
export function GoalsByPeriodChart({ data }: { data: { period: string; goals: number }[] }) {
  return (
    <div className="h-36 w-full" role="img" aria-label="Tore nach Spielabschnitten">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: -24 }}>
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis dataKey="period" {...axis} />
          <YAxis {...axis} allowDecimals={false} />
          <Tooltip cursor={{ fill: "var(--muted)", opacity: 0.4 }} contentStyle={tooltipStyle} formatter={(v) => [String(v), "Tore"]} labelFormatter={(l) => `Minute ${l}`} />
          <Bar dataKey="goals" fill="var(--chart-1)" radius={[3, 3, 0, 0]} maxBarSize={32} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
