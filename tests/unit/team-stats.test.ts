import { describe, expect, it } from "vitest";
import { summarizeTeam, type TeamStatLine } from "@/lib/team-stats";

const line = (o: Partial<TeamStatLine>): TeamStatLine => ({
  goals: 1, goalsConceded: 1, xg: 1, xga: 1, possessionPct: 50, passes: 400, passAccuracyPct: 80,
  shots: 10, shotsOnTarget: 4, corners: 5, setPieceGoals: 0, ppda: 10, goalsByPeriod: null, ...o,
});

describe("summarizeTeam", () => {
  it("bildet Mittelwerte je Spiel", () => {
    const s = summarizeTeam([line({ goals: 3, xg: 2.4 }), line({ goals: 1, xg: 0.6 })]);
    expect(s.goalsPerMatch).toBe(2);
    expect(s.xgPerMatch).toBeCloseTo(1.5);
  });
  it("gewichtet die Passquote nach Pässen", () => {
    const s = summarizeTeam([line({ passes: 100, passAccuracyPct: 50 }), line({ passes: 300, passAccuracyPct: 90 })]);
    expect(s.passAccuracyPct).toBeCloseTo(80);
  });
  it("berechnet die Zu-Null-Quote und summiert Tore nach Spielabschnitten", () => {
    const s = summarizeTeam([
      line({ goalsConceded: 0, goalsByPeriod: { "0-15": 1, "76-90": 1 } }),
      line({ goalsConceded: 2, goalsByPeriod: { "76-90": 2 } }),
    ]);
    expect(s.cleanSheetRate).toBe(0.5);
    expect(s.goalsByPeriod).toEqual({ "0-15": 1, "76-90": 3 });
  });
  it("liefert null statt 0, wenn eine Kennzahl nie geliefert wurde", () => {
    const s = summarizeTeam([line({ ppda: null, xg: null })]);
    expect(s.ppda).toBeNull();
    expect(s.xgPerMatch).toBeNull();
  });
});
