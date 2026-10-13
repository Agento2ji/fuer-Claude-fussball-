import { describe, expect, it } from "vitest";
import { computeStandings } from "@/lib/standings";

const names = new Map([[1, "Alpha"], [2, "Beta"], [3, "Gamma"]]);
const d = (day: number) => new Date(Date.UTC(2026, 8, day));

describe("computeStandings", () => {
  const table = computeStandings(
    [
      { homeTeamId: 1, awayTeamId: 2, homeScore: 2, awayScore: 0, kickoffAt: d(1) },
      { homeTeamId: 2, awayTeamId: 3, homeScore: 1, awayScore: 1, kickoffAt: d(8) },
      { homeTeamId: 3, awayTeamId: 1, homeScore: 3, awayScore: 1, kickoffAt: d(15) },
    ],
    names,
  );

  it("vergibt 3/1/0 Punkte und sortiert nach Punkten, Tordifferenz, Toren", () => {
    expect(table.map((r) => [r.name, r.points, r.goalDifference])).toEqual([
      ["Gamma", 4, 2],
      ["Alpha", 3, 0],
      ["Beta", 1, -2],
    ]);
    expect(table.map((r) => r.position)).toEqual([1, 2, 3]);
  });

  it("führt die Form mit dem neuesten Ergebnis zuerst", () => {
    expect(table.find((r) => r.name === "Alpha")!.form).toEqual(["N", "S"]);
  });

  it("listet Teams ohne Spiel mit null Punkten", () => {
    const t = computeStandings([], names);
    expect(t).toHaveLength(3);
    expect(t.every((r) => r.played === 0 && r.points === 0)).toBe(true);
  });

  it("begrenzt die Form auf fünf Spiele", () => {
    const many = Array.from({ length: 7 }, (_, i) => ({ homeTeamId: 1, awayTeamId: 2, homeScore: i % 2, awayScore: 0, kickoffAt: d(i + 1) }));
    expect(computeStandings(many, names).find((r) => r.teamId === 1)!.form).toHaveLength(5);
  });
});
