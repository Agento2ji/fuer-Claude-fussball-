/**
 * Filter und Sortierung der Value-Übersicht auf der Startseite. Rein, ohne
 * Datenbank – die Werte kommen aus den URL-Parametern.
 */
import { RISK_LEVELS } from "@/config/value";
import type { RiskKey, ValueBet } from "./value";

export const BOARD_SORTS = [
  { key: "verhaeltnis", label: "Bestes Verhältnis" },
  { key: "ev", label: "Höchster EV" },
  { key: "anstoss", label: "Anstoß" },
] as const;
export type BoardSort = (typeof BOARD_SORTS)[number]["key"];

export const BOARD_MARKETS = [
  { key: "h2h", label: "1X2" },
  { key: "totals", label: "Über/Unter" },
] as const;

export interface BoardFilter {
  liga: string | null;
  markt: string | null;
  /** Höchstes zugelassenes Risiko; null = alle. */
  risiko: RiskKey | null;
  sort: BoardSort;
}

type Params = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? null;

export function parseBoardFilter(params: Params): BoardFilter {
  const sort = one(params.sort);
  const risiko = one(params.risiko);
  const markt = one(params.markt);
  return {
    liga: one(params.liga),
    markt: BOARD_MARKETS.some((m) => m.key === markt) ? markt : null,
    risiko: RISK_LEVELS.some((r) => r.key === risiko) ? (risiko as RiskKey) : null,
    sort: BOARD_SORTS.some((s) => s.key === sort) ? (sort as BoardSort) : "verhaeltnis",
  };
}

/** URL für einen geänderten Filter; Standardwerte fallen weg. */
export function boardHref(filter: BoardFilter, change: Partial<BoardFilter>): string {
  const next = { ...filter, ...change };
  const q = new URLSearchParams();
  if (next.liga) q.set("liga", next.liga);
  if (next.markt) q.set("markt", next.markt);
  if (next.risiko) q.set("risiko", next.risiko);
  if (next.sort !== "verhaeltnis") q.set("sort", next.sort);
  const s = q.toString();
  return s ? `/?${s}` : "/";
}

interface BoardTip {
  match: { competitionCode: string; kickoffAt: Date };
  bet: ValueBet;
}

const riskRank = (r: RiskKey) => RISK_LEVELS.findIndex((x) => x.key === r);

export function applyBoardFilter<T extends BoardTip>(tips: readonly T[], f: BoardFilter): T[] {
  const filtered = tips.filter(
    (t) =>
      (!f.liga || t.match.competitionCode === f.liga) &&
      (!f.markt || t.bet.market === f.markt) &&
      (!f.risiko || riskRank(t.bet.risk!) <= riskRank(f.risiko)),
  );
  const by: Record<BoardSort, (a: T, b: T) => number> = {
    verhaeltnis: (a, b) => b.bet.score - a.bet.score,
    ev: (a, b) => b.bet.ev! - a.bet.ev!,
    anstoss: (a, b) => a.match.kickoffAt.getTime() - b.match.kickoffAt.getTime() || b.bet.score - a.bet.score,
  };
  return [...filtered].sort(by[f.sort]);
}
