import { describe, expect, it } from "vitest";
import { CURRENT_SEASON } from "@/config/competitions";
import { buildTestWorld } from "@/ingestion/providers/testdaten";

const now = new Date("2026-10-13T12:00:00Z");
const world = buildTestWorld(now);

describe("Testdaten", () => {
  it("sind deterministisch", () => {
    expect(buildTestWorld(now)).toEqual(world);
  });

  const current = world.matches.filter((m) => m.season === CURRENT_SEASON.label);

  it("bilden je Saison eine vollständige Doppelrunde", () => {
    expect(world.teams).toHaveLength(6);
    expect(current).toHaveLength(30);
    const pairs = new Set(current.map((m) => `${m.homeTeam.externalId}-${m.awayTeam.externalId}`));
    expect(pairs.size).toBe(30);
    expect(world.matches).toHaveLength(4 * 30);
  });

  it("geben jungen Spielern eine kürzere Karriere", () => {
    const appearances = (pid: string) => new Set(world.stats.filter((s) => s.playerExternalId === pid).map((s) => s.matchExternalId.split("-m")[0])).size;
    const young = world.players.find((p) => Number(p.birthDate!.slice(0, 4)) >= 2007)!;
    const veteran = world.players.find((p) => Number(p.birthDate!.slice(0, 4)) <= 2000 && p.position === "forward")!;
    expect(appearances(young.externalId)).toBeLessThan(appearances(veteran.externalId));
  });

  it("haben gespielte Partien in der Vergangenheit, offene in der Zukunft", () => {
    for (const m of current) {
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
