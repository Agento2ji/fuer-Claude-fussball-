/**
 * Formbewertung mit erfundenen, aber realistischen Datensätzen:
 * Bundesliga-Stürmer mit typischen Werten pro 90 (xG ≈ 0,35, Schüsse aufs
 * Tor ≈ 1,2, Schlüsselpässe ≈ 1,0 …), dazu Ausreißer in beide Richtungen.
 */
import { describe, expect, it } from "vitest";
import {
  buildReference,
  computeForm,
  formRating,
  type MatchScore,
  metricValues,
  percentileOf,
  type PerformanceRow,
  scoreMatch,
  tierFor,
} from "@/lib/form";

const NOW = new Date("2026-10-13T12:00:00Z");
const day = 86_400_000;

/** Deterministischer Zufall, damit die Tests stabil sind. */
function rng(seed: number) {
  let a = seed;
  return () => {
    a = (a * 1664525 + 1013904223) % 4294967296;
    return a / 4294967296;
  };
}

let nextId = 1;
function forwardRow(o: Partial<PerformanceRow> & { daysAgo?: number; level?: number } = {}, r = rng(nextId)): PerformanceRow {
  const level = o.level ?? 1; // 1 = normale Leistung
  const { daysAgo = 7, level: _l, ...rest } = o;
  return {
    matchId: nextId++,
    kickoffAt: new Date(NOW.getTime() - daysAgo * day),
    competitionCode: "BL1",
    season: "2026/27",
    position: "forward",
    minutes: 90,
    goals: r() < 0.3 * level ? 1 : 0,
    assists: r() < 0.15 * level ? 1 : 0,
    xg: +(0.35 * level * (0.6 + r() * 0.8)).toFixed(3),
    xa: +(0.15 * level * (0.6 + r() * 0.8)).toFixed(3),
    shotsOnTarget: Math.round(1.2 * level * (0.5 + r())),
    keyPasses: Math.round(1.0 * level * (0.5 + r())),
    dribblesSuccessful: Math.round(1.1 * level * (0.5 + r())),
    duelsWon: 5,
    tackles: 1,
    clearances: 0,
    passes: 25,
    passesCompleted: 19,
    errorsLeadingToGoal: 0,
    saves: null,
    goalsConceded: null,
    psxgFaced: null,
    ...rest,
  };
}

/** Vergleichsgruppe: 200 Stürmerleistungen derselben Liga und Saison. */
const reference = Array.from({ length: 200 }, (_, i) => forwardRow({ daysAgo: 1 + (i % 60) }, rng(1000 + i)));

/** Karriere: n Spiele, ältestes zuerst, im Wochenabstand bis zu `endDaysAgo`. */
function career(n: number, level: (i: number) => number, endDaysAgo = 3): PerformanceRow[] {
  return Array.from({ length: n }, (_, i) =>
    forwardRow({ daysAgo: endDaysAgo + (n - 1 - i) * 7, level: level(i), season: "2026/27" }, rng(5000 + i * 7 + n)),
  );
}

describe("metricValues", () => {
  it("normiert Zählwerte auf 90 Minuten, lässt Quoten unverändert", () => {
    const v = metricValues(forwardRow({ minutes: 45, goals: 1, assists: 0, xg: 0.4, passes: 20, passesCompleted: 15 }));
    expect(v.scorerPoints).toBe(2);
    expect(v.xg).toBeCloseTo(0.8);
    expect(v.passAccuracy).toBeCloseTo(0.75);
  });

  it("lässt fehlende Kennzahlen weg, statt 0 anzunehmen", () => {
    const v = metricValues(forwardRow({ xg: null, xa: null }));
    expect(v).not.toHaveProperty("xg");
    expect(v).not.toHaveProperty("xa");
  });
});

describe("Standardisierung und Spielwert", () => {
  const ref = buildReference(reference);

  it("bewertet eine überdurchschnittliche Leistung positiv, eine schwache negativ", () => {
    expect(scoreMatch(forwardRow({ level: 2 }, rng(1)), ref)!.score).toBeGreaterThan(0.5);
    expect(scoreMatch(forwardRow({ level: 0.3 }, rng(1)), ref)!.score).toBeLessThan(-0.5);
  });

  it("verteilt das Gewicht fehlender Kennzahlen auf die übrigen", () => {
    const s = scoreMatch(forwardRow({ xg: null }, rng(3)), ref)!;
    expect(s.contributions).not.toHaveProperty("xg");
    const sum = Object.values(s.contributions).reduce((a, b) => a + b!, 0);
    expect(s.score).toBeCloseTo(sum); // BL1: Ligastärke 1,0 → keine Verschiebung
  });

  it("vergleicht nur innerhalb derselben Position", () => {
    const keeper = forwardRow({ position: "goalkeeper" }, rng(4));
    expect(scoreMatch(keeper, ref)).toBeNull();
  });

  it("zieht Leistungen in schwächeren Ligen leicht nach unten", () => {
    const fl1Ref = buildReference(reference.map((r) => ({ ...r, competitionCode: "FL1" })));
    const row = forwardRow({}, rng(9));
    const bl1 = scoreMatch(row, ref)!.score;
    const fl1 = scoreMatch({ ...row, competitionCode: "FL1" }, fl1Ref)!.score;
    expect(fl1).toBeCloseTo(bl1 - 0.08);
  });

  it("ignoriert Kurzeinsätze in der Vergleichsverteilung", () => {
    const withCameos = buildReference([...reference, ...Array.from({ length: 50 }, () => forwardRow({ minutes: 5, goals: 1, xg: 0.5 }))]);
    expect(withCameos.get("BL1|2026/27|forward")!.xg!.n).toBe(reference.length);
  });
});

describe("Formstufe gegen die eigene Karriere", () => {
  it("erkennt eine Bestform nach 30 normalen Spielen und 5 herausragenden", () => {
    const rows = career(35, (i) => (i >= 30 ? 2.2 : 1));
    const f = computeForm(rows, reference, NOW);
    expect(f.status).toBe("ok");
    if (f.status !== "ok") return;
    expect(f.tier).toBe("bestform");
    expect(f.percentile).toBeGreaterThan(90);
    expect(f.matchesUsed).toHaveLength(5);
    expect(f.shortCareer).toBe(false);
    expect(f.drivers).toHaveLength(2);
    expect(f.drivers.every((d) => d.contribution > 0)).toBe(true);
  });

  it("erkennt ein Formtief", () => {
    const f = computeForm(career(35, (i) => (i >= 30 ? 0.3 : 1)), reference, NOW);
    expect(f.status === "ok" && f.tier).toBe("schlecht");
  });

  it("meldet zu wenig Daten bei weniger als 3 Spielen mit 30+ Minuten", () => {
    const rows = [
      ...career(20, () => 1, 150), // lange Karriere, aber älter als 120 Tage
      forwardRow({ daysAgo: 3, minutes: 20 }), // zu kurz
      forwardRow({ daysAgo: 10, minutes: 90 }),
      forwardRow({ daysAgo: 17, minutes: 25 }), // zu kurz
      forwardRow({ daysAgo: 24, minutes: 60 }),
    ];
    const f = computeForm(rows, reference, NOW);
    expect(f.status).toBe("zu-wenig-daten");
    if (f.status === "zu-wenig-daten") {
      expect(f.matchesUsed).toHaveLength(2);
      expect(f.careerWindows).toBeGreaterThan(0);
    }
  });

  it("bewertet nach langer Pause nicht mit alten Spielen", () => {
    const f = computeForm(career(30, () => 1, 200), reference, NOW);
    expect(f.status).toBe("zu-wenig-daten");
    if (f.status === "zu-wenig-daten") expect(f.reason).toMatch(/120 Tagen/);
  });

  it("warnt bei kurzer Karriere, dass Bestform wenig aussagt", () => {
    const f = computeForm(career(9, () => 1), reference, NOW);
    expect(f.status === "ok" && f.shortCareer).toBe(true);
  });

  it("vergleicht ein kurzes aktuelles Fenster mit gleich kurzen Karriereabschnitten", () => {
    // 3 aktuelle Spiele mit Wert 1, Karriere davor abwechselnd 0 und 2 (Mittel 1).
    const scores: MatchScore[] = [
      ...Array.from({ length: 20 }, (_, i) => ({
        matchId: i,
        kickoffAt: new Date(NOW.getTime() - (300 - i * 7) * day),
        minutes: 90,
        score: i % 2 === 0 ? 0 : 2,
        contributions: {},
      })),
      ...[1, 2, 3].map((k) => ({ matchId: 100 + k, kickoffAt: new Date(NOW.getTime() - k * 7 * day), minutes: 90, score: 1, contributions: {} })),
    ];
    const f = formRating(scores, NOW);
    expect(f.matchesUsed).toHaveLength(3);
    // Karriere aus 3er-Abschnitten: 20 Spiele + 3 aktuelle = 21 Abschnitte.
    expect(f.careerWindows).toBe(21);
  });

  it("nimmt nur die letzten 5 qualifizierten Spiele", () => {
    const scores: MatchScore[] = Array.from({ length: 8 }, (_, i) => ({
      matchId: i,
      kickoffAt: new Date(NOW.getTime() - (8 - i) * 7 * day),
      minutes: 90,
      score: i,
      contributions: {},
    }));
    const f = formRating(scores, NOW);
    expect(f.matchesUsed.map((m) => m.matchId)).toEqual([3, 4, 5, 6, 7]);
  });
});

describe("Stufen-Grenzen", () => {
  it("folgen wörtlich der Vorgabe", () => {
    expect(tierFor(24.9).key).toBe("schlecht");
    expect(tierFor(25).key).toBe("mittel");
    expect(tierFor(59.9).key).toBe("mittel");
    expect(tierFor(60).key).toBe("gut");
    expect(tierFor(90).key).toBe("gut");
    expect(tierFor(90.1).key).toBe("bestform");
  });

  it("zählt Gleichstände zur Hälfte", () => {
    expect(percentileOf(2, [1, 2, 3, 4])).toBe(37.5);
  });
});
