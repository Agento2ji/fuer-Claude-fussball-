"use client";

import dynamic from "next/dynamic";

/**
 * Diagramme erst nach dem ersten Rendern laden: Die Diagramm-Bibliothek ist
 * groß und würde sonst auf langsamen Handys die Anzeige der Seite bremsen.
 * Platzhalter in gleicher Höhe verhindern Layoutsprünge.
 */
const placeholder = (height: string) =>
  function ChartPlaceholder() {
    return <div className={`${height} w-full animate-pulse rounded-md bg-muted/50`} aria-hidden />;
  };

export const SeasonChart = dynamic(() => import("./season-chart").then((m) => m.SeasonChart), {
  ssr: false,
  loading: placeholder("h-52"),
});

export const XgChart = dynamic(() => import("./team-charts").then((m) => m.XgChart), {
  ssr: false,
  loading: placeholder("h-48"),
});

export const GoalsByPeriodChart = dynamic(() => import("./team-charts").then((m) => m.GoalsByPeriodChart), {
  ssr: false,
  loading: placeholder("h-36"),
});
