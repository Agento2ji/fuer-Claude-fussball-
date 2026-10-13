import { describe, expect, it } from "vitest";
import { age, monthsBetween, playerStatus, summarize, yellowCardRisk } from "@/lib/player-status";

describe("playerStatus", () => {
  it("priorisiert Sperre vor Verletzung", () => {
    expect(playerStatus({ activeInjury: { status: "injured" }, activeSuspension: { reason: "red" } })).toMatchObject({ kind: "rotsperre", traffic: "danger" });
  });
  it("unterscheidet verletzt und angeschlagen", () => {
    expect(playerStatus({ activeInjury: { status: "injured" }, activeSuspension: null }).traffic).toBe("danger");
    expect(playerStatus({ activeInjury: { status: "doubtful" }, activeSuspension: null }).traffic).toBe("warn");
  });
  it("ist ohne Befund einsatzbereit", () => {
    expect(playerStatus({ activeInjury: null, activeSuspension: null })).toMatchObject({ kind: "einsatzbereit", traffic: "ok" });
  });
});

describe("yellowCardRisk", () => {
  it("zählt bis zur nächsten Sperre und markiert eine Karte Abstand", () => {
    expect(yellowCardRisk(4, 5)).toEqual({ untilSuspension: 1, atRisk: true });
    expect(yellowCardRisk(2, 5)).toEqual({ untilSuspension: 3, atRisk: false });
  });
  it("beginnt nach einer Sperre von vorn (10. Gelbe)", () => {
    expect(yellowCardRisk(5, 5)).toEqual({ untilSuspension: 5, atRisk: false });
    expect(yellowCardRisk(9, 5)).toEqual({ untilSuspension: 1, atRisk: true });
  });
  it("rät nichts ohne hinterlegte Regel", () => {
    expect(yellowCardRisk(4, null)).toEqual({ untilSuspension: null, atRisk: false });
  });
});

describe("Datumshilfen", () => {
  const now = new Date("2026-10-13T12:00:00Z");
  it("rechnet volle Monate Restlaufzeit", () => {
    expect(monthsBetween(now, "2027-06-30")).toBe(8);
    expect(monthsBetween(now, "2026-10-12")).toBe(0);
  });
  it("rechnet das Alter tagesgenau", () => {
    expect(age("2000-10-14", now)).toBe(25);
    expect(age("2000-10-13", now)).toBe(26);
  });
});

describe("summarize", () => {
  const line = (o: Partial<Parameters<typeof summarize>[0][number]>) => ({
    minutes: 90, goals: 0, assists: 0, shots: 0, shotsOnTarget: 0, xg: 0, xa: 0, passes: 0, passesCompleted: 0,
    keyPasses: 0, duels: 0, duelsWon: 0, dribblesSuccessful: 0, rating: 6, saves: null, goalsConceded: null, psxgFaced: null, ...o,
  });
  it("bildet Quoten aus Summen, nicht als Mittel der Einzelquoten", () => {
    const s = summarize([line({ passes: 10, passesCompleted: 10 }), line({ passes: 90, passesCompleted: 45 })]);
    expect(s.passAccuracy).toBeCloseTo(0.55);
  });
  it("lässt xG leer, wenn keine Quelle xG liefert", () => {
    expect(summarize([line({ xg: null })]).xg).toBeNull();
  });
  it("berechnet verhinderte Tore für Torhüter", () => {
    const s = summarize([line({ psxgFaced: 2.4, goalsConceded: 1 }), line({ psxgFaced: 0.5, goalsConceded: 1 })]);
    expect(s.goalsPrevented).toBeCloseTo(0.9);
  });
});
