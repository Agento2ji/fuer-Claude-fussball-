/**
 * Tabelle aus Spielergebnissen. Rein, ohne Datenbank.
 *
 * Sortierung: Punkte, Tordifferenz, erzielte Tore, dann Name. Das entspricht
 * der Bundesliga-Regel bis auf den direkten Vergleich; andere Ligen nutzen
 * teils den direkten Vergleich früher (z. B. LaLiga, Serie A). Bei
 * Punktgleichheit kann die Platzierung daher von der offiziellen abweichen.
 */

export interface ResultInput {
  homeTeamId: number;
  awayTeamId: number;
  homeScore: number;
  awayScore: number;
  kickoffAt: Date;
}

export type Outcome = "S" | "U" | "N";

export interface StandingRow {
  teamId: number;
  name: string;
  position: number;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
  /** Letzte fünf Ergebnisse, neuestes zuerst. */
  form: Outcome[];
}

export function computeStandings(
  results: ResultInput[],
  teamNames: Map<number, string>,
): StandingRow[] {
  const rows = new Map<number, Omit<StandingRow, "position">>();
  const row = (id: number) => {
    let r = rows.get(id);
    if (!r) {
      r = { teamId: id, name: teamNames.get(id) ?? `Team ${id}`, played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, goalDifference: 0, points: 0, form: [] };
      rows.set(id, r);
    }
    return r;
  };
  for (const id of teamNames.keys()) row(id);

  const sorted = [...results].sort((a, b) => b.kickoffAt.getTime() - a.kickoffAt.getTime());
  for (const m of sorted) {
    for (const [id, gf, ga] of [
      [m.homeTeamId, m.homeScore, m.awayScore],
      [m.awayTeamId, m.awayScore, m.homeScore],
    ] as const) {
      const r = row(id);
      r.played++;
      r.goalsFor += gf;
      r.goalsAgainst += ga;
      const outcome: Outcome = gf > ga ? "S" : gf < ga ? "N" : "U";
      if (outcome === "S") { r.won++; r.points += 3; }
      else if (outcome === "U") { r.drawn++; r.points += 1; }
      else r.lost++;
      if (r.form.length < 5) r.form.push(outcome);
    }
  }
  return [...rows.values()]
    .map((r) => ({ ...r, goalDifference: r.goalsFor - r.goalsAgainst }))
    .sort(
      (a, b) =>
        b.points - a.points ||
        b.goalDifference - a.goalDifference ||
        b.goalsFor - a.goalsFor ||
        a.name.localeCompare(b.name, "de"),
    )
    .map((r, i) => ({ ...r, position: i + 1 }));
}
