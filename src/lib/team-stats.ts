/** Saisonmittel aus Team-Spielstatistiken. Rein, ohne Datenbank. */

/** Spielabschnitte für „Tore nach Spielabschnitten“. */
export const GOAL_PERIODS = ["0-15", "16-30", "31-45", "46-60", "61-75", "76-90"] as const;

export interface TeamStatLine {
  goals: number | null;
  goalsConceded: number | null;
  xg: number | null;
  xga: number | null;
  possessionPct: number | null;
  passes: number | null;
  passAccuracyPct: number | null;
  shots: number | null;
  shotsOnTarget: number | null;
  corners: number | null;
  setPieceGoals: number | null;
  ppda: number | null;
  goalsByPeriod: Record<string, number> | null;
}

export interface TeamSeasonSummary {
  matches: number;
  goalsPerMatch: number | null;
  concededPerMatch: number | null;
  xgPerMatch: number | null;
  xgaPerMatch: number | null;
  possessionPct: number | null;
  /** Gewichtet nach Pässen, nicht Mittel der Einzelquoten. */
  passAccuracyPct: number | null;
  shotsPerMatch: number | null;
  shotsOnTargetPerMatch: number | null;
  cornersPerMatch: number | null;
  setPieceGoals: number | null;
  ppda: number | null;
  cleanSheetRate: number | null;
  goalsByPeriod: Record<string, number>;
}

function mean(xs: (number | null)[]): number | null {
  const v = xs.filter((x): x is number => x !== null);
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
}

export function summarizeTeam(lines: TeamStatLine[]): TeamSeasonSummary {
  const withPasses = lines.filter((l) => l.passes && l.passAccuracyPct !== null);
  const passTotal = withPasses.reduce((a, l) => a + l.passes!, 0);
  const conceded = lines.map((l) => l.goalsConceded).filter((x): x is number => x !== null);
  const setPieces = lines.map((l) => l.setPieceGoals).filter((x): x is number => x !== null);
  const goalsByPeriod: Record<string, number> = {};
  for (const l of lines) {
    for (const [k, v] of Object.entries(l.goalsByPeriod ?? {})) goalsByPeriod[k] = (goalsByPeriod[k] ?? 0) + v;
  }
  return {
    matches: lines.length,
    goalsPerMatch: mean(lines.map((l) => l.goals)),
    concededPerMatch: mean(lines.map((l) => l.goalsConceded)),
    xgPerMatch: mean(lines.map((l) => l.xg)),
    xgaPerMatch: mean(lines.map((l) => l.xga)),
    possessionPct: mean(lines.map((l) => l.possessionPct)),
    passAccuracyPct: passTotal
      ? withPasses.reduce((a, l) => a + l.passes! * l.passAccuracyPct!, 0) / passTotal
      : null,
    shotsPerMatch: mean(lines.map((l) => l.shots)),
    shotsOnTargetPerMatch: mean(lines.map((l) => l.shotsOnTarget)),
    cornersPerMatch: mean(lines.map((l) => l.corners)),
    setPieceGoals: setPieces.length ? setPieces.reduce((a, b) => a + b, 0) : null,
    ppda: mean(lines.map((l) => l.ppda)),
    cleanSheetRate: conceded.length ? conceded.filter((c) => c === 0).length / conceded.length : null,
    goalsByPeriod,
  };
}
