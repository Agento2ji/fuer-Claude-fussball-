/**
 * Value-Analyse mit erfundenen, aber realistischen Quoten:
 * Pinnacle als scharfer Markt (~2,5 % Marge), Tipico/Winamax mit 5–7 %.
 */
import { describe, expect, it } from "vitest";
import { devigPower } from "@/lib/odds/devig";
import { abroadHints, analyzeMarket, kelly, type MarketAnalysis, type MarketInput, riskLevel, valueBets } from "@/lib/odds/value";

const NOW = new Date("2026-10-13T12:00:00Z");
const fresh = new Date(NOW.getTime() - 5 * 60_000);
const old = new Date(NOW.getTime() - 40 * 60_000);
const q = (price: number, fetchedAt = fresh) => ({ price, fetchedAt });

const h2h: MarketInput = {
  market: "h2h",
  line: null,
  selections: ["home", "draw", "away"],
  quotes: {
    pinnacle: { home: q(2.1), draw: q(3.55), away: q(3.75) },
    tipico: { home: q(2.0), draw: q(3.4), away: q(3.8) },
    winamax: { home: q(2.2), draw: q(3.3), away: q(3.5, old) },
  },
};

describe("analyzeMarket", () => {
  const a = analyzeMarket(h2h, NOW)!;
  const home = a.selections[0]!;
  const away = a.selections[2]!;

  it("bildet faire Wahrscheinlichkeiten mit Summe 1", () => {
    const sum = a.selections.reduce((s, x) => s + x.fairProbability, 0);
    expect(sum).toBeCloseTo(1, 9);
    expect(a.consensusSize).toBe(3);
  });

  it("gewichtet jeden Anbieter mit 1 / Marge", () => {
    const books = [[2.1, 3.55, 3.75], [2.0, 3.4, 3.8], [2.2, 3.3, 3.5]];
    const w = books.map((o) => 1 / (o.reduce((s, x) => s + 1 / x, 0) - 1));
    const expected = books.reduce((s, o, i) => s + w[i]! * devigPower(o)[0]!, 0) / w.reduce((s, x) => s + x, 0);
    expect(home.fairProbability).toBeCloseTo(expected, 12);
    // Pinnacle (2,4 % Marge) zählt mehr als doppelt so viel wie Tipico (5,7 %).
    expect(w[0]! / w[1]!).toBeGreaterThan(2);
  });

  it("zeigt nur Anbieter mit deutscher Erlaubnis und markiert die beste Quote", () => {
    expect(home.prices.map((p) => p.bookmakerKey).sort()).toEqual(["tipico", "winamax"]);
    expect(home.best).toMatchObject({ bookmakerKey: "winamax", price: 2.2 });
    expect(home.prices.find((p) => p.isBest)!.bookmakerKey).toBe("winamax");
  });

  it("rechnet EV und Kelly nach der Formel aus der Vorgabe", () => {
    expect(home.ev).toBeCloseTo(home.fairProbability * 2.2 - 1, 12);
    expect(home.kellyFull).toBeCloseTo(kelly(home.fairProbability, 2.2), 12);
    expect(home.kellyShown).toBeCloseTo(Math.max(0, home.kellyFull!) / 4, 12);
  });

  it("zeigt bei negativem EV einen Kelly-Anteil von 0", () => {
    const negative = a.selections.find((s) => s.ev! < 0)!;
    expect(negative.kellyShown).toBe(0);
  });

  it("markiert Quoten älter als 15 Minuten als veraltet", () => {
    expect(away.best!.bookmakerKey).toBe("tipico");
    expect(away.stale).toBe(false);
    const winOnly = analyzeMarket({ ...h2h, quotes: { pinnacle: h2h.quotes.pinnacle!, winamax: h2h.quotes.winamax! } }, NOW)!;
    expect(winOnly.selections[2]!.stale).toBe(true);
  });

  it("hat ohne zugelassenen Anbieter keine beste Quote und keinen EV", () => {
    const pinOnly = analyzeMarket({ ...h2h, quotes: { pinnacle: h2h.quotes.pinnacle! } }, NOW)!;
    expect(pinOnly.selections.every((s) => s.best === null && s.ev === null)).toBe(true);
  });

  it("ignoriert unvollständige Märkte im Konsens", () => {
    const partial = analyzeMarket({ ...h2h, quotes: { ...h2h.quotes, tipico: { home: q(2.0) } } }, NOW)!;
    expect(partial.consensusSize).toBe(2);
  });
});

describe("valueBets", () => {
  const sel = (selection: string, price: number, ev: number) => {
    const p = (1 + ev) / price;
    const stdDev = price * Math.sqrt(p * (1 - p));
    return {
      selection, fairProbability: p, fairOdds: 1 / p, byMethod: { proportional: p, power: p, shin: p },
      prices: [], best: { bookmakerKey: "tipico", price, fetchedAt: fresh }, abroad: null, ev, kellyFull: kelly(p, price),
      kellyShown: kelly(p, price) / 4, stdDev, risk: riskLevel(stdDev), stale: false,
    };
  };
  const markets: MarketAnalysis[] = [
    { market: "h2h", line: null, margins: {}, consensusSize: 3, selections: [sel("home", 1.5, 0.04), sel("draw", 4.0, 0.01), sel("away", 8.0, 0.06)] },
    { market: "totals", line: 2.5, margins: {}, consensusSize: 3, selections: [sel("over", 1.9, 0.025), sel("under", 2.0, -0.05)] },
  ];
  const { all, top } = valueBets(markets);

  it("filtert alles unter 2 % EV weg und sortiert nach EV", () => {
    expect(all.map((b) => b.selection)).toEqual(["away", "home", "over"]);
  });

  it("bevorzugt bei den Top 3 ordentlichen EV mit wenig Schwankung", () => {
    expect(top[0]!.selection).toBe("home");
    expect(top.at(-1)!.selection).toBe("away");
  });

  it("stuft das Risiko nach der Schwankung der Auszahlung ein", () => {
    expect(riskLevel(0.7)).toBe("low");
    expect(riskLevel(1.5)).toBe("medium");
    expect(riskLevel(2.7)).toBe("high");
  });
});

describe("Auslandsversionen", () => {
  const withAbroad: MarketInput = {
    ...h2h,
    quotes: { ...h2h.quotes, betway: { home: q(2.05), draw: q(3.9), away: q(3.6) } },
  };
  const a = analyzeMarket(withAbroad, NOW)!;
  const draw = a.selections[1]!;

  it("werden angezeigt, zählen aber nie als beste spielbare Quote", () => {
    expect(draw.prices.map((p) => p.bookmakerKey).sort()).toEqual(["betway", "tipico", "winamax"]);
    expect(draw.prices.find((p) => p.bookmakerKey === "betway")!.playable).toBe(false);
    expect(draw.best!.bookmakerKey).toBe("tipico");
    expect(draw.prices.find((p) => p.isBest)!.bookmakerKey).toBe("tipico");
    expect(draw.ev).toBeCloseTo(draw.fairProbability * 3.4 - 1, 12);
  });

  it("liefern einen getrennten Hinweis mit eigenem EV", () => {
    expect(draw.abroad).toMatchObject({ bookmakerKey: "betway", price: 3.9 });
    expect(draw.abroad!.ev).toBeCloseTo(draw.fairProbability * 3.9 - 1, 12);
    const hints = abroadHints([a]);
    expect(hints.every((h) => h.abroad.ev >= 0.02)).toBe(true);
    expect(hints.some((h) => h.selection === "draw")).toBe(true);
  });

  it("tauchen nicht in den Value-Tipps auf", () => {
    const { all } = valueBets([a]);
    expect(all.every((b) => b.best!.bookmakerKey !== "betway")).toBe(true);
  });
});
