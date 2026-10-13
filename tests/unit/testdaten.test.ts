import { describe, expect, it } from "vitest";
import { buildTestWorld } from "@/ingestion/providers/testdaten";

const now = new Date("2026-10-13T12:00:00Z");
const world = buildTestWorld(now);

describe("Testdaten", () => {
  it("sind deterministisch", () => {
    expect(buildTestWorld(now)).toEqual(world);
  });

  it("bilden eine vollständige Doppelrunde", () => {
    expect(world.teams).toHaveLength(6);
    expect(world.matches).toHaveLength(30);
    const pairs = new Set(world.matches.map((m) => `${m.homeTeam.externalId}-${m.awayTeam.externalId}`));
    expect(pairs.size).toBe(30);
  });

  it("haben gespielte Partien in der Vergangenheit, offene in der Zukunft", () => {
    for (const m of world.matches) {
      if (m.status === "finished") expect(m.kickoffAt < now).toBe(true);
      else expect(m.kickoffAt > now).toBe(true);
    }
  });

  it("verteilen genau die erzielten Tore auf die Spieler", () => {
    for (const m of world.matches.filter((x) => x.status === "finished")) {
      const goals = (team: string) =>
        world.stats
          .filter((s) => s.matchExternalId === m.externalId && s.teamExternalId === team)
          .reduce((sum, s) => sum + (s.goals ?? 0), 0);
      expect(goals(m.homeTeam.externalId)).toBe(m.homeScore);
      expect(goals(m.awayTeam.externalId)).toBe(m.awayScore);
    }
  });

  it("lassen keinen Spieler mehr als 90 Minuten spielen", () => {
    expect(world.stats.every((s) => s.minutes > 0 && s.minutes <= 90)).toBe(true);
  });

  it("liefern Quoten nur für offene Spiele und nur > 1", () => {
    const open = new Set(world.matches.filter((m) => m.status === "scheduled").map((m) => m.externalId));
    expect(world.odds.length).toBeGreaterThan(0);
    expect(world.odds.every((o) => open.has(o.match.externalId) && o.price > 1)).toBe(true);
  });
});
