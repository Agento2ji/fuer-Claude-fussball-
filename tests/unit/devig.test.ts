import { describe, expect, it } from "vitest";
import { devig, devigPower, devigProportional, devigShin, margin } from "@/lib/odds/devig";

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
// Typischer 1X2-Markt: klarer Favorit, Außenseiter bei 7,0; rund 6 % Marge.
const market = [1.4, 4.5, 7.0];

describe("Devigging", () => {
  it("berechnet die Marge", () => {
    expect(margin([1.9, 1.9])).toBeCloseTo(0.0526, 3);
  });

  it.each(["proportional", "power", "shin"] as const)("%s ergibt Wahrscheinlichkeiten mit Summe 1", (method) => {
    const p = devig(market, method);
    expect(sum(p)).toBeCloseTo(1, 9);
    expect(p.every((x) => x > 0 && x < 1)).toBe(true);
  });

  it("behandelt symmetrische Märkte bei allen Methoden gleich", () => {
    for (const p of [devigProportional([1.9, 1.9]), devigPower([1.9, 1.9]), devigShin([1.9, 1.9])]) {
      expect(p[0]).toBeCloseTo(0.5, 9);
    }
  });

  it("ziehen Power und Shin dem Außenseiter mehr Marge ab als proportional", () => {
    const prop = devigProportional(market);
    for (const p of [devigPower(market), devigShin(market)]) {
      expect(p[2]!).toBeLessThan(prop[2]!);
      expect(p[0]!).toBeGreaterThan(prop[0]!);
    }
  });

  it("lässt margenfreie Märkte unverändert", () => {
    expect(devigPower([2, 2])).toEqual([0.5, 0.5]);
    expect(devigShin([3, 3, 3]).every((x) => Math.abs(x - 1 / 3) < 1e-12)).toBe(true);
  });

  it("lehnt ungültige Quoten ab", () => {
    expect(() => devigPower([1, 2])).toThrow(/Ungültiger Markt/);
    expect(() => devigShin([2])).toThrow(/Ungültiger Markt/);
  });
});
