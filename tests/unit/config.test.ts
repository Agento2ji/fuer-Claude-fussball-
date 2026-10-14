import { describe, expect, it } from "vitest";
import { BOOKMAKERS, bookmakerLabel, isPlayableInGermany } from "@/config/bookmakers";
import { COMPETITIONS, getCompetition } from "@/config/competitions";
import { DATA_SOURCES } from "@/config/data-sources";

const unique = (values: readonly string[]) =>
  new Set(values).size === values.length;

describe("Wettbewerbe", () => {
  it("haben eindeutige Codes", () => {
    expect(unique(COMPETITIONS.map((c) => c.code))).toBe(true);
  });

  it("decken den Scope von Version 1 mit eigenen Spielseiten ab", () => {
    const withPages = COMPETITIONS.filter((c) => c.hasMatchPages).map(
      (c) => c.code,
    );
    expect(withPages.sort()).toEqual(
      ["BL1", "CL", "EL", "FL1", "PD", "PL", "SA"].sort(),
    );
  });

  it("haben eine plausible Sperrgrenze oder bewusst keine", () => {
    for (const c of COMPETITIONS) {
      const t = c.yellowCardSuspensionThreshold;
      expect(t === null || (Number.isInteger(t) && t > 0)).toBe(true);
    }
    expect(getCompetition("BL1")?.yellowCardSuspensionThreshold).toBe(5);
  });
});

describe("Buchmacher", () => {
  it("haben eindeutige Schlüssel", () => {
    expect(unique(BOOKMAKERS.map((b) => b.key))).toBe(true);
  });

  it("zeigen Pinnacle nie im Vergleich, nutzen ihn aber als Referenz", () => {
    const pinnacle = BOOKMAKERS.find((b) => b.key === "pinnacle");
    expect(pinnacle?.showInComparison).toBe(false);
    expect(pinnacle?.useForFairPrice).toBe(true);
  });

  it("zeigen nur Anbieter mit deutscher Erlaubnis", () => {
    for (const b of BOOKMAKERS.filter((x) => x.showInComparison)) expect(b.ggl).not.toBeNull();
  });

  it("rechnen Value-Tipps nur mit deutschen Seiten (Tipico, Winamax)", () => {
    const playable = BOOKMAKERS.filter(isPlayableInGermany).map((b) => b.key);
    expect(playable.sort()).toEqual(["tipico", "winamax"]);
  });

  it("kennzeichnen Auslandsversionen mit ihrer Seite", () => {
    const abroad = BOOKMAKERS.filter((b) => b.showInComparison && b.site === "ausland");
    expect(abroad.map((b) => b.key).sort()).toEqual(["betano", "betway", "leovegas"]);
    for (const b of abroad) expect(bookmakerLabel(b)).toMatch(/\(UK\)$/);
  });

  it("bleiben unter 10 Anbietern, damit ein Abruf 1 Credit je Markt kostet", () => {
    expect(BOOKMAKERS.length).toBeLessThanOrEqual(10);
  });
});

describe("Datenquellen", () => {
  it("haben eindeutige Schlüssel", () => {
    expect(unique(DATA_SOURCES.map((s) => s.key))).toBe(true);
  });
});
