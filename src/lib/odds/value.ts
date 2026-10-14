/**
 * Quotenvergleich und Value-Analyse nach Abschnitt 6 – rein, ohne Datenbank.
 *
 * 1. Je Buchmacher und Markt die Marge entfernen (Power als Hauptmethode,
 *    proportional und Shin zum Vergleich).
 * 2. Faire Wahrscheinlichkeit = Konsens über alle Anbieter, gewichtet mit
 *    1 / Marge (schärfere Märkte zählen mehr).
 * 3. EV = faire Wahrscheinlichkeit × beste verfügbare Quote − 1, wobei nur
 *    deutsche Seiten von Anbietern mit deutscher Erlaubnis als „verfügbar“
 *    gelten. Auslandsversionen werden angezeigt und getrennt als Hinweis
 *    bewertet, aber nie als Value-Tipp gezählt.
 * 4. Kelly f = (p·q − 1) / (q − 1), angezeigt wird ein Viertel.
 * 5. Risiko = Standardabweichung der Auszahlung je 1 € Einsatz.
 */
import { BOOKMAKERS, type BookmakerConfig, isComparable, isPlayableInGermany } from "@/config/bookmakers";
import { KELLY_FRACTION, MARGIN_FLOOR, MIN_EV, PRIMARY_DEVIG, RISK_LEVELS, STALE_MINUTES, TOP_N } from "@/config/value";
import { devig, type DevigMethod, margin } from "./devig";

export interface Quote {
  price: number;
  fetchedAt: Date;
}

/** Ein Markt eines Spiels, z. B. 1X2 oder Über/Unter 2,5. */
export interface MarketInput {
  market: string;
  line: number | null;
  /** Alle Ausgänge des Marktes in fester Reihenfolge. */
  selections: string[];
  /** Quoten je Buchmacher-Schlüssel und Ausgang. */
  quotes: Record<string, Record<string, Quote>>;
}

export type RiskKey = (typeof RISK_LEVELS)[number]["key"];

export interface SelectionAnalysis {
  selection: string;
  fairProbability: number;
  fairOdds: number;
  byMethod: Record<DevigMethod, number>;
  /** Quoten der angezeigten Anbieter (deutsche Seiten und Auslandsversionen). */
  prices: { bookmakerKey: string; price: number; fetchedAt: Date; isBest: boolean; playable: boolean }[];
  /** Beste Quote einer deutschen Seite – Grundlage für EV, Kelly und Risiko. */
  best: { bookmakerKey: string; price: number; fetchedAt: Date } | null;
  /** Beste Quote einer Auslandsversion, nur als Richtwert. */
  abroad: { bookmakerKey: string; price: number; fetchedAt: Date; ev: number } | null;
  ev: number | null;
  kellyFull: number | null;
  kellyShown: number | null;
  stdDev: number | null;
  risk: RiskKey | null;
  stale: boolean;
}

export interface MarketAnalysis {
  market: string;
  line: number | null;
  selections: SelectionAnalysis[];
  /** Marge je Buchmacher, der den Markt vollständig anbietet. */
  margins: Record<string, number>;
  /** Anzahl Anbieter im Konsens (inkl. nicht angezeigter Referenz). */
  consensusSize: number;
}

const METHODS: DevigMethod[] = ["proportional", "power", "shin"];
const byKey = new Map<string, BookmakerConfig>(BOOKMAKERS.map((b) => [b.key, b]));

export function riskLevel(stdDev: number): RiskKey {
  return (RISK_LEVELS.find((r) => stdDev <= r.maxStdDev) ?? RISK_LEVELS[RISK_LEVELS.length - 1]!).key;
}

/** Kelly-Anteil für Wahrscheinlichkeit p und Dezimalquote q. */
export function kelly(p: number, q: number): number {
  return (p * q - 1) / (q - 1);
}

export function analyzeMarket(input: MarketInput, now: Date): MarketAnalysis | null {
  const complete = Object.entries(input.quotes).filter(([, q]) => input.selections.every((s) => q[s] && q[s].price > 1));
  const consensus = complete.filter(([key]) => byKey.get(key)?.useForFairPrice);
  if (consensus.length === 0) return null;

  const margins: Record<string, number> = {};
  const weighted: Record<DevigMethod, number[]> = { proportional: [], power: [], shin: [] };
  let weightSum = 0;
  for (const method of METHODS) weighted[method] = input.selections.map(() => 0);
  for (const [key, q] of consensus) {
    const odds = input.selections.map((s) => q[s]!.price);
    const m = margin(odds);
    margins[key] = m;
    const w = 1 / Math.max(m, MARGIN_FLOOR);
    weightSum += w;
    for (const method of METHODS) {
      devig(odds, method).forEach((p, i) => (weighted[method][i]! += w * p));
    }
  }
  for (const [key, q] of complete) {
    if (!(key in margins)) margins[key] = margin(input.selections.map((s) => q[s]!.price));
  }

  const selections = input.selections.map((selection, i): SelectionAnalysis => {
    const byMethod = Object.fromEntries(METHODS.map((m) => [m, weighted[m][i]! / weightSum])) as Record<DevigMethod, number>;
    const p = byMethod[PRIMARY_DEVIG];
    const prices = Object.entries(input.quotes)
      .filter(([key, q]) => q[selection] && byKey.get(key) && isComparable(byKey.get(key)!))
      .map(([key, q]) => ({
        bookmakerKey: key,
        price: q[selection]!.price,
        fetchedAt: q[selection]!.fetchedAt,
        isBest: false,
        playable: isPlayableInGermany(byKey.get(key)!),
      }));
    const best = highest(prices.filter((x) => x.playable));
    if (best) best.isBest = true;
    const top = highest(prices.filter((x) => !x.playable));
    const abroad = top
      ? { bookmakerKey: top.bookmakerKey, price: top.price, fetchedAt: top.fetchedAt, ev: p * top.price - 1 }
      : null;
    if (!best) {
      return { selection, fairProbability: p, fairOdds: 1 / p, byMethod, prices, best: null, abroad, ev: null, kellyFull: null, kellyShown: null, stdDev: null, risk: null, stale: false };
    }
    const q = best.price;
    const ev = p * q - 1;
    const kellyFull = kelly(p, q);
    const stdDev = q * Math.sqrt(p * (1 - p));
    return {
      selection,
      fairProbability: p,
      fairOdds: 1 / p,
      byMethod,
      prices,
      best: { bookmakerKey: best.bookmakerKey, price: q, fetchedAt: best.fetchedAt },
      abroad,
      ev,
      kellyFull,
      kellyShown: Math.max(0, kellyFull) * KELLY_FRACTION,
      stdDev,
      risk: riskLevel(stdDev),
      stale: now.getTime() - best.fetchedAt.getTime() > STALE_MINUTES * 60_000,
    };
  });

  return { market: input.market, line: input.line, selections, margins, consensusSize: consensus.length };
}

/** Höchste Quote; bei Gleichstand gewinnt die frischere. */
function highest<T extends { price: number; fetchedAt: Date }>(prices: T[]): T | undefined {
  return [...prices].sort((a, b) => b.price - a.price || b.fetchedAt.getTime() - a.fetchedAt.getTime())[0];
}

export interface ValueBet extends SelectionAnalysis {
  market: string;
  line: number | null;
  /** EV je Einheit Schwankung – höher ist besser. */
  score: number;
}

/**
 * Alle Wetten mit EV ≥ Mindestwert, sortiert nach EV; `top` sind die drei
 * mit dem besten Verhältnis aus EV und Risiko (EV / σ): Ein niedriger
 * Kelly-Anteil bei ordentlichem EV schlägt eine hohe, volatile Quote.
 */
export function valueBets(markets: MarketAnalysis[]): { all: ValueBet[]; top: ValueBet[] } {
  const all: ValueBet[] = markets
    .flatMap((m) =>
      m.selections
        .filter((s) => s.ev !== null && s.ev >= MIN_EV && s.stdDev)
        .map((s) => ({ ...s, market: m.market, line: m.line, score: s.ev! / s.stdDev! })),
    )
    .sort((a, b) => b.ev! - a.ev!);
  const top = [...all].sort((a, b) => b.score - a.score).slice(0, TOP_N);
  return { all, top };
}

export interface AbroadHint extends SelectionAnalysis {
  market: string;
  line: number | null;
  abroad: NonNullable<SelectionAnalysis["abroad"]>;
}

/**
 * Ausgänge, bei denen eine Auslandsversion mindestens den Mindest-EV
 * erreicht und mehr bietet als die beste deutsche Quote. Nur ein Hinweis,
 * die Quote auf der deutschen Seite des Anbieters selbst zu prüfen.
 */
export function abroadHints(markets: MarketAnalysis[]): AbroadHint[] {
  return markets
    .flatMap((m) =>
      m.selections
        .filter((s) => s.abroad && s.abroad.ev >= MIN_EV && (!s.best || s.abroad.price > s.best.price))
        .map((s) => ({ ...s, market: m.market, line: m.line, abroad: s.abroad! })),
    )
    .sort((a, b) => b.abroad.ev - a.abroad.ev);
}
