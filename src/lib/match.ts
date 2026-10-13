/** Reine Hilfsfunktionen für die Spielseite. */

export interface CountdownParts {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  started: boolean;
}

export function countdownParts(kickoffAt: Date, now: Date): CountdownParts {
  const diff = kickoffAt.getTime() - now.getTime();
  if (diff <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0, started: true };
  const s = Math.floor(diff / 1000);
  return {
    days: Math.floor(s / 86_400),
    hours: Math.floor((s % 86_400) / 3600),
    minutes: Math.floor((s % 3600) / 60),
    seconds: s % 60,
    started: false,
  };
}

export interface DuelInput {
  homeTeamId: number;
  awayTeamId: number;
  homeScore: number;
  awayScore: number;
}

/** Bilanz aus Sicht von `teamA`: Siege, Remis, Niederlagen, Tore. */
export function headToHead(duels: DuelInput[], teamA: number) {
  let wins = 0;
  let draws = 0;
  let losses = 0;
  let goalsFor = 0;
  let goalsAgainst = 0;
  for (const d of duels) {
    const aHome = d.homeTeamId === teamA;
    const gf = aHome ? d.homeScore : d.awayScore;
    const ga = aHome ? d.awayScore : d.homeScore;
    goalsFor += gf;
    goalsAgainst += ga;
    if (gf > ga) wins++;
    else if (gf < ga) losses++;
    else draws++;
  }
  return { played: duels.length, wins, draws, losses, goalsFor, goalsAgainst };
}
