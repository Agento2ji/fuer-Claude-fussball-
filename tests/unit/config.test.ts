import { describe, expect, it } from "vitest";
import { BOOKMAKERS } from "@/config/bookmakers";
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

  it("vergleichen nur Tipico und Winamax", () => {
    const shown = BOOKMAKERS.filter((b) => b.showInComparison).map(
      (b) => b.key,
    );
    expect(shown.sort()).toEqual(["tipico", "winamax"]);
  });
});

describe("Datenquellen", () => {
  it("haben eindeutige Schlüssel", () => {
    expect(unique(DATA_SOURCES.map((s) => s.key))).toBe(true);
  });
});
