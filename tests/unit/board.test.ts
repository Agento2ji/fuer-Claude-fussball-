import { describe, expect, it } from "vitest";
import { applyBoardFilter, boardHref, parseBoardFilter } from "@/lib/odds/board";
import type { ValueBet } from "@/lib/odds/value";

const bet = (market: string, ev: number, score: number, risk: "low" | "medium" | "high") =>
  ({ market, ev, score, risk }) as unknown as ValueBet;
const tip = (code: string, day: number, b: ValueBet) => ({
  match: { competitionCode: code, kickoffAt: new Date(Date.UTC(2026, 9, day)) },
  bet: b,
});

const tips = [
  tip("BL1", 20, bet("h2h", 0.08, 0.02, "high")),
  tip("PL", 18, bet("totals", 0.03, 0.03, "low")),
  tip("BL1", 19, bet("totals", 0.05, 0.04, "medium")),
];

describe("Value-Übersicht", () => {
  it("liest nur gültige Filter aus der URL", () => {
    expect(parseBoardFilter({ markt: "quatsch", risiko: "low", sort: "ev", liga: "BL1" })).toEqual({
      liga: "BL1",
      markt: null,
      risiko: "low",
      sort: "ev",
    });
    expect(parseBoardFilter({}).sort).toBe("verhaeltnis");
  });

  it("sortiert standardmäßig nach dem Verhältnis aus EV und Schwankung", () => {
    const out = applyBoardFilter(tips, parseBoardFilter({}));
    expect(out.map((t) => t.bet.score)).toEqual([0.04, 0.03, 0.02]);
  });

  it("filtert nach Liga, Markt und höchstem Risiko", () => {
    expect(applyBoardFilter(tips, parseBoardFilter({ liga: "BL1" }))).toHaveLength(2);
    expect(applyBoardFilter(tips, parseBoardFilter({ markt: "h2h" }))).toHaveLength(1);
    const medium = applyBoardFilter(tips, parseBoardFilter({ risiko: "medium" }));
    expect(medium.map((t) => t.bet.risk).sort()).toEqual(["low", "medium"]);
  });

  it("sortiert auf Wunsch nach EV oder Anstoß", () => {
    expect(applyBoardFilter(tips, parseBoardFilter({ sort: "ev" }))[0]!.bet.ev).toBe(0.08);
    expect(applyBoardFilter(tips, parseBoardFilter({ sort: "anstoss" }))[0]!.match.competitionCode).toBe("PL");
  });

  it("baut Links ohne Standardwerte", () => {
    const f = parseBoardFilter({});
    expect(boardHref(f, {})).toBe("/");
    expect(boardHref(f, { liga: "PL", sort: "ev" })).toBe("/?liga=PL&sort=ev");
  });
});
