/**
 * TESTDATEN – vollständig erfunden.
 *
 * Eine fiktive „Testliga“ mit fiktiven Vereinen und Spielern, damit UI,
 * Formbewertung und Value-Rechnung ohne API-Keys entwickelt werden können.
 * Bewusst keine echten Namen: Eine erfundene Verletzung eines echten
 * Spielers wäre eine Falschinformation, auch in einer Testumgebung.
 *
 * Deterministisch: gleicher Startzeitpunkt → gleiche Daten.
 * Diese Quelle steht in keiner Fallback-Kette und wird nur über
 * `npm run ingest -- testdaten` eingespielt.
 */
import { CURRENT_SEASON } from "@/config/competitions";
import { GOAL_PERIODS } from "@/lib/team-stats";
import type {
  BroadcastProvider,
  BroadcastRecord,
  ContractProvider,
  ContractRecord,
  InjuryProvider,
  InjuryRecord,
  LineupRecord,
  MatchProvider,
  MatchRecord,
  OddsProvider,
  OddsRecord,
  PlayerMatchStatsRecord,
  PlayerProvider,
  PlayerRecord,
  Position,
  Provenance,
  Sourced,
  SuspensionProvider,
  SuspensionRecord,
  TeamMatchStatsRecord,
  TeamRecord,
} from "../types";

export const TEST_COMPETITION = {
  code: "TEST",
  name: "Testliga (erfunden)",
  country: "DE",
  type: "league" as const,
  hasMatchPages: true,
  yellowCardSuspensionThreshold: 5,
  timezone: "Europe/Berlin",
};

const TEAMS: { name: string; strength: number }[] = [
  { name: "FC Nordstadt", strength: 1.35 },
  { name: "SV Hafenberg", strength: 1.2 },
  { name: "Eintracht Talburg", strength: 1.05 },
  { name: "Sportfreunde Lindenau", strength: 0.95 },
  { name: "Union Westerfeld", strength: 0.85 },
  { name: "TSV Bergheide", strength: 0.75 },
];

const FIRST_NAMES = [
  "Lukas", "Jonas", "Felix", "Noah", "Elias", "Paul", "Leon", "Finn", "Moritz",
  "Jannik", "Tim", "Nico", "Ben", "Malte", "Ole", "Henrik", "Matteo", "Emil",
  "Linus", "Anton", "Jakob", "Theo", "Milan", "Samuel",
];
const LAST_NAMES = [
  "Brandt", "Kessler", "Vogt", "Lorenz", "Hartmann", "Seidel", "Pohl",
  "Engel", "Kraus", "Winter", "Sommer", "Albrecht", "Busch", "Franke", "Graf",
  "Haas", "Jansen", "Kuhn", "Lindner", "Marx", "Naumann", "Ott", "Peters",
  "Ritter", "Schade", "Thiel", "Ulrich", "Voss", "Wendt", "Zeller",
];

const SQUAD_SHAPE: { position: Position; detailed: string; count: number }[] = [
  { position: "goalkeeper", detailed: "Torwart", count: 2 },
  { position: "defender", detailed: "Innenverteidiger", count: 4 },
  { position: "defender", detailed: "Außenverteidiger", count: 2 },
  { position: "midfielder", detailed: "Zentrales Mittelfeld", count: 4 },
  { position: "midfielder", detailed: "Offensives Mittelfeld", count: 2 },
  { position: "forward", detailed: "Mittelstürmer", count: 2 },
  { position: "forward", detailed: "Flügelstürmer", count: 2 },
];

const STARTING_SLOTS: Record<Position, number> = {
  goalkeeper: 1,
  defender: 4,
  midfielder: 4,
  forward: 2,
};

const BOOKMAKER_MARGINS: Record<string, number> = {
  tipico: 0.065,
  winamax: 0.055,
  pinnacle: 0.025,
};

// ---------------------------------------------------------------------------
// Deterministischer Zufall
// ---------------------------------------------------------------------------

function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function rng(seed: string): () => number {
  let a = hash(seed);
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function poisson(lambda: number, r: () => number): number {
  const l = Math.exp(-lambda);
  let k = 0;
  let p = 1;
  do {
    k++;
    p *= r();
  } while (p > l);
  return k - 1;
}

const round = (v: number, digits = 2) => Number(v.toFixed(digits));
const isoDate = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (d: Date, days: number) =>
  new Date(d.getTime() + days * 86_400_000);

// ---------------------------------------------------------------------------
// Die erfundene Welt
// ---------------------------------------------------------------------------

export interface TestWorld {
  teams: TeamRecord[];
  players: PlayerRecord[];
  matches: MatchRecord[];
  stats: PlayerMatchStatsRecord[];
  teamStats: TeamMatchStatsRecord[];
  lineups: LineupRecord[];
  injuries: InjuryRecord[];
  suspensions: SuspensionRecord[];
  contracts: ContractRecord[];
  broadcasts: BroadcastRecord[];
  odds: OddsRecord[];
}

/** Paarungen für eine Doppelrunde (Kreisverfahren). */
function roundRobin(n: number): [number, number][][] {
  const ids = [...Array(n).keys()];
  const rounds: [number, number][][] = [];
  for (let r = 0; r < n - 1; r++) {
    const pairs: [number, number][] = [];
    for (let i = 0; i < n / 2; i++) {
      const a = ids[i]!;
      const b = ids[n - 1 - i]!;
      pairs.push(r % 2 === 0 ? [a, b] : [b, a]);
    }
    rounds.push(pairs);
    ids.splice(1, 0, ids.pop()!);
  }
  return [...rounds, ...rounds.map((p) => p.map(([a, b]) => [b, a] as [number, number]))];
}

/** Letzter Samstag 15:30 Uhr Berliner Zeit (13:30 UTC) vor `now`. */
function lastSaturday(now: Date): Date {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 13, 30));
  while (d.getUTCDay() !== 6 || d > now) d.setUTCDate(d.getUTCDate() - 1);
  return d;
}

export function buildTestWorld(now: Date, playedMatchdays = 7, historySeasons = 3): TestWorld {
  const r = rng("testwelt");
  const teams: TeamRecord[] = TEAMS.map((t, i) => ({
    externalId: `test-t${i + 1}`,
    name: t.name,
    shortName: t.name.split(" ").pop() ?? t.name,
    country: "DE",
  }));

  // Kader
  const players: PlayerRecord[] = [];
  const squads: PlayerRecord[][] = teams.map((team, ti) => {
    const squad: PlayerRecord[] = [];
    let shirt = 1;
    for (const slot of SQUAD_SHAPE) {
      for (let k = 0; k < slot.count; k++) {
        const first = FIRST_NAMES[Math.floor(r() * FIRST_NAMES.length)]!;
        const last = LAST_NAMES[Math.floor(r() * LAST_NAMES.length)]!;
        const age = 19 + Math.floor(r() * 15);
        const birth = new Date(Date.UTC(now.getUTCFullYear() - age, Math.floor(r() * 12), 1 + Math.floor(r() * 28)));
        const p: PlayerRecord = {
          externalId: `test-p${ti + 1}-${shirt}`,
          teamExternalId: team.externalId,
          name: `${first} ${last}`,
          firstName: first,
          lastName: last,
          birthDate: isoDate(birth),
          nationality: "Testland",
          position: slot.position,
          detailedPosition: slot.detailed,
          shirtNumber: shirt,
        };
        shirt++;
        squad.push(p);
        players.push(p);
      }
    }
    return squad;
  });

  // Formfaktoren der laufenden Saison: ein Stürmer in Bestform, einer im Formtief.
  const hot = squads[0]![15]!.externalId;
  const cold = squads[2]![14]!.externalId;
  const currentBoost = (p: PlayerRecord) => (p.externalId === hot ? 1.7 : p.externalId === cold ? 0.45 : 1);

  // Vorsaisons, damit die Formbewertung eine Karriere zum Vergleich hat.
  // Spieler unter 21 haben keine Vorsaisons (kurze Karriere, siehe Hinweis in der UI).
  const schedule = roundRobin(teams.length);
  const history = buildHistory(teams, squads, schedule, now, historySeasons);

  const firstKickoff = addDays(lastSaturday(now), -7 * (playedMatchdays - 1));
  const matches: MatchRecord[] = [];
  const stats: PlayerMatchStatsRecord[] = [];
  const cardsByPlayer = new Map<string, { yellow: number; lastMatch: string }>();

  schedule.forEach((pairs, mdIndex) => {
    const matchday = mdIndex + 1;
    const kickoffAt = addDays(firstKickoff, 7 * mdIndex);
    for (const [hi, ai] of pairs) {
      const home = teams[hi]!;
      const away = teams[ai]!;
      const externalId = `test-m${matchday}-${hi + 1}-${ai + 1}`;
      const played = matchday <= playedMatchdays;
      const mr = rng(externalId);
      const homeXg = 1.45 * TEAMS[hi]!.strength / TEAMS[ai]!.strength ** 0.6;
      const awayXg = 1.1 * TEAMS[ai]!.strength / TEAMS[hi]!.strength ** 0.6;
      const homeScore = played ? poisson(homeXg, mr) : null;
      const awayScore = played ? poisson(awayXg, mr) : null;
      matches.push({
        externalId,
        competitionCode: TEST_COMPETITION.code,
        season: CURRENT_SEASON.label,
        matchday,
        stage: `Spieltag ${matchday}`,
        homeTeam: home,
        awayTeam: away,
        kickoffAt,
        kickoffTimeKnown: true,
        status: played ? "finished" : "scheduled",
        homeScore,
        awayScore,
      });
      if (!played) continue;
      for (const [side, ti, goals, conceded, xg] of [
        ["home", hi, homeScore!, awayScore!, homeXg],
        ["away", ai, awayScore!, homeScore!, awayXg],
      ] as const) {
        stats.push(
          ...playerStatsForMatch(squads[ti]!, externalId, teams[ti]!.externalId, goals, conceded, xg, rng(`${externalId}-${side}`), cardsByPlayer, currentBoost),
        );
      }
    }
  });

  // Verfügbarkeit
  const injuries: InjuryRecord[] = [
    { playerExternalId: squads[0]![14]!.externalId, status: "injured", injuryType: "Muskelfaserriss", description: "Oberschenkel hinten", since: isoDate(addDays(now, -12)), expectedReturn: isoDate(addDays(now, 16)) },
    { playerExternalId: squads[1]![4]!.externalId, status: "injured", injuryType: "Kreuzbandriss", description: "Knie rechts", since: isoDate(addDays(now, -60)), expectedReturn: isoDate(addDays(now, 150)) },
    { playerExternalId: squads[2]![9]!.externalId, status: "doubtful", injuryType: "Prellung", description: "Sprunggelenk", since: isoDate(addDays(now, -3)), expectedReturn: isoDate(addDays(now, 4)) },
  ];

  // Ein „Kartensammler“, damit die Sperrgefahr-Anzeige etwas zu zeigen hat:
  // genau vier Gelbe in seinen ersten vier Einsätzen, sonst keine.
  const collector = squads[4]![9]!.externalId;
  let collected = 0;
  for (const s of stats) {
    if (s.playerExternalId !== collector) continue;
    s.yellowCards = collected < 4 ? 1 : 0;
    s.redCards = 0;
    collected++;
  }
  cardsByPlayer.clear();
  for (const s of stats) {
    if (!s.yellowCards) continue;
    const c = cardsByPlayer.get(s.playerExternalId);
    cardsByPlayer.set(s.playerExternalId, {
      yellow: (c?.yellow ?? 0) + 1,
      lastMatch: s.matchExternalId,
    });
  }

  const lastPlayed = matches.filter((m) => m.status === "finished").at(-1)!;
  const suspensions: SuspensionRecord[] = [
    { playerExternalId: squads[3]![3]!.externalId, reason: "red", competitionCode: TEST_COMPETITION.code, matchesCount: 2, triggeredByMatchExternalId: lastPlayed.externalId },
  ];
  for (const [pid, c] of cardsByPlayer) {
    if (c.yellow >= TEST_COMPETITION.yellowCardSuspensionThreshold) {
      suspensions.push({ playerExternalId: pid, reason: "yellow_accumulation", competitionCode: TEST_COMPETITION.code, matchesCount: 1, triggeredByMatchExternalId: c.lastMatch });
    }
  }

  const contracts: ContractRecord[] = players.map((p) => {
    const cr = rng(`vertrag-${p.externalId}`);
    const endYear = now.getUTCFullYear() + 1 + Math.floor(cr() * 4);
    return {
      playerExternalId: p.externalId,
      teamExternalId: p.teamExternalId,
      startDate: `${endYear - 3}-07-01`,
      endDate: `${endYear}-06-30`,
      isLoan: cr() < 0.06,
      marketValueEur: Math.round((0.3 + cr() * 18) * 1_000_000 / 50_000) * 50_000,
      marketValueDate: isoDate(addDays(now, -Math.floor(cr() * 90))),
    };
  });

  const broadcasts: BroadcastRecord[] = matches.map((m, i) => ({
    matchExternalId: m.externalId,
    country: "DE",
    broadcaster: i % 3 === 0 ? "Test-Free-TV" : "Test-Stream (Abo)",
    isPaid: i % 3 !== 0,
    url: null,
  }));

  const odds: OddsRecord[] = matches
    .filter((m) => m.status === "scheduled")
    .flatMap((m) => oddsForMatch(m, now));

  // Aufstellungen: bestätigt für gespielte Partien (Startelf = mindestens 45 Minuten),
  // voraussichtlich für das jeweils nächste Spiel jedes Teams – ohne Verletzte und Gesperrte.
  const lineups: LineupRecord[] = [];
  const byId = new Map(players.map((p) => [p.externalId, p]));
  for (const m of matches.filter((x) => x.status === "finished")) {
    for (const s of stats.filter((x) => x.matchExternalId === m.externalId)) {
      const p = byId.get(s.playerExternalId)!;
      lineups.push({
        matchExternalId: m.externalId,
        teamExternalId: s.teamExternalId,
        playerExternalId: p.externalId,
        isProbable: false,
        isStarter: s.minutes >= 45,
        positionLabel: p.detailedPosition,
        shirtNumber: p.shirtNumber,
        formation: "4-4-2",
      });
    }
  }
  const unavailable = new Set([
    ...injuries.filter((i) => i.status === "injured").map((i) => i.playerExternalId),
    ...suspensions.map((x) => x.playerExternalId),
  ]);
  for (const team of teams) {
    const next = matches.find(
      (m) => m.status === "scheduled" && (m.homeTeam.externalId === team.externalId || m.awayTeam.externalId === team.externalId),
    );
    if (!next) continue;
    const recentMinutes = (pid: string) =>
      stats.filter((x) => x.playerExternalId === pid).slice(-3).reduce((a, x) => a + x.minutes, 0);
    const squad = players.filter((p) => p.teamExternalId === team.externalId && !unavailable.has(p.externalId));
    for (const pos of Object.keys(STARTING_SLOTS) as Position[]) {
      const ranked = squad
        .filter((p) => p.position === pos)
        .sort((a, b) => recentMinutes(b.externalId) - recentMinutes(a.externalId) || a.shirtNumber! - b.shirtNumber!);
      ranked.slice(0, STARTING_SLOTS[pos]).forEach((p) =>
        lineups.push({
          matchExternalId: next.externalId,
          teamExternalId: team.externalId,
          playerExternalId: p.externalId,
          isProbable: true,
          isStarter: true,
          positionLabel: p.detailedPosition,
          shirtNumber: p.shirtNumber,
          formation: "4-4-2",
        }),
      );
    }
  }

  const allMatches = [...history.matches, ...matches];
  const allStats = [...history.stats, ...stats];
  const teamStats = allMatches
    .filter((m) => m.status === "finished")
    .flatMap((m) => teamStatsForMatch(m, allStats));

  return { teams, players, matches: allMatches, stats: allStats, teamStats, lineups, injuries, suspensions, contracts, broadcasts, odds };
}

/** Saisonbezeichnung, z. B. 2025 → "2025/26". */
export function seasonLabel(startYear: number): string {
  return `${startYear}/${String((startYear + 1) % 100).padStart(2, "0")}`;
}

function buildHistory(
  teams: TeamRecord[],
  squads: PlayerRecord[][],
  schedule: [number, number][][],
  now: Date,
  seasons: number,
): { matches: MatchRecord[]; stats: PlayerMatchStatsRecord[] } {
  const matches: MatchRecord[] = [];
  const stats: PlayerMatchStatsRecord[] = [];
  const ignoredCards = new Map<string, { yellow: number; lastMatch: string }>();
  for (let k = seasons; k >= 1; k--) {
    const startYear = CURRENT_SEASON.startYear - k;
    const season = seasonLabel(startYear);
    const seasonStart = new Date(Date.UTC(startYear, 7, 22, 13, 30));
    // Wer zu Saisonbeginn jünger als 18 war, spielte noch nicht mit.
    const eligible = (p: PlayerRecord) =>
      !p.birthDate || seasonStart.getUTCFullYear() - Number(p.birthDate.slice(0, 4)) >= 18;
    const boost = (p: PlayerRecord) => 0.75 + rng(`form-${season}-${p.externalId}`)() * 0.5;
    schedule.forEach((pairs, mdIndex) => {
      const matchday = mdIndex + 1;
      const kickoffAt = addDays(seasonStart, 7 * mdIndex);
      for (const [hi, ai] of pairs) {
        const externalId = `test-h${startYear}-m${matchday}-${hi + 1}-${ai + 1}`;
        const mr = rng(externalId);
        const homeXg = 1.45 * TEAMS[hi]!.strength / TEAMS[ai]!.strength ** 0.6;
        const awayXg = 1.1 * TEAMS[ai]!.strength / TEAMS[hi]!.strength ** 0.6;
        const homeScore = poisson(homeXg, mr);
        const awayScore = poisson(awayXg, mr);
        matches.push({
          externalId,
          competitionCode: TEST_COMPETITION.code,
          season,
          matchday,
          stage: `Spieltag ${matchday}`,
          homeTeam: teams[hi]!,
          awayTeam: teams[ai]!,
          kickoffAt,
          kickoffTimeKnown: true,
          status: "finished",
          homeScore,
          awayScore,
        });
        for (const [side, ti, goals, conceded, xg] of [
          ["home", hi, homeScore, awayScore, homeXg],
          ["away", ai, awayScore, homeScore, awayXg],
        ] as const) {
          const squad = squads[ti]!;
          // Nur Spieler, die damals schon spielten – solange jede Position besetzbar bleibt.
          const available = (Object.keys(STARTING_SLOTS) as Position[]).flatMap((pos) => {
            const all = squad.filter((p) => p.position === pos);
            const old = all.filter(eligible);
            return old.length >= STARTING_SLOTS[pos] + (pos === "goalkeeper" ? 0 : 1) ? old : all;
          });
          stats.push(
            ...playerStatsForMatch(available, externalId, teams[ti]!.externalId, goals, conceded, xg, rng(`${externalId}-${side}`), ignoredCards, boost),
          );
        }
      }
    });
  }
  return { matches, stats };
}

function playerStatsForMatch(
  squad: PlayerRecord[],
  matchExternalId: string,
  teamExternalId: string,
  goals: number,
  conceded: number,
  teamXg: number,
  r: () => number,
  cardsByPlayer: Map<string, { yellow: number; lastMatch: string }>,
  /** Formfaktor je Spieler (1 = normal), damit Formschwankungen messbar sind. */
  boost: (p: PlayerRecord) => number = () => 1,
): PlayerMatchStatsRecord[] {
  // Startelf je Position, dazu bis zu drei Einwechslungen.
  const starters: PlayerRecord[] = [];
  const bench: PlayerRecord[] = [];
  for (const pos of Object.keys(STARTING_SLOTS) as Position[]) {
    const options = squad.filter((p) => p.position === pos);
    const shuffled = [...options].sort(() => r() - 0.5);
    starters.push(...shuffled.slice(0, STARTING_SLOTS[pos]));
    bench.push(...shuffled.slice(STARTING_SLOTS[pos]).filter((p) => p.position !== "goalkeeper"));
  }
  const subs = bench.sort(() => r() - 0.5).slice(0, 3);
  const minutes = new Map<string, number>();
  starters.forEach((p) => minutes.set(p.externalId, 90));
  subs.forEach((p, i) => {
    const on = 60 + Math.floor(r() * 25);
    minutes.set(p.externalId, 90 - on);
    const outgoing = starters.filter((s) => s.position !== "goalkeeper")[3 + i * 2]!;
    minutes.set(outgoing.externalId, on);
  });
  const lineup = [...starters, ...subs];

  // Tore und Vorlagen auf Feldspieler verteilen, gewichtet nach Position.
  const weight = (p: PlayerRecord) =>
    (p.position === "forward" ? 5 : p.position === "midfielder" ? 2.5 : p.position === "defender" ? 0.7 : 0) *
    (minutes.get(p.externalId)! / 90) *
    boost(p);
  const pick = (exclude?: string) => {
    const pool = lineup.filter((p) => p.externalId !== exclude);
    const total = pool.reduce((s, p) => s + weight(p), 0);
    let x = r() * total;
    for (const p of pool) {
      x -= weight(p);
      if (x <= 0) return p;
    }
    return pool[0]!;
  };
  const goalsBy = new Map<string, number>();
  const assistsBy = new Map<string, number>();
  for (let g = 0; g < goals; g++) {
    const scorer = pick();
    goalsBy.set(scorer.externalId, (goalsBy.get(scorer.externalId) ?? 0) + 1);
    if (r() < 0.75) {
      const assister = pick(scorer.externalId);
      assistsBy.set(assister.externalId, (assistsBy.get(assister.externalId) ?? 0) + 1);
    }
  }
  const totalWeight = lineup.reduce((s, p) => s + weight(p), 0);

  return lineup.map((p) => {
    const mins = minutes.get(p.externalId)!;
    const share = mins / 90;
    const g = goalsBy.get(p.externalId) ?? 0;
    const a = assistsBy.get(p.externalId) ?? 0;
    const isGk = p.position === "goalkeeper";
    const isDef = p.position === "defender";
    const b = boost(p);
    const xg = isGk ? 0 : round((teamXg * weight(p)) / totalWeight * (0.6 + r() * 0.8), 3);
    const passes = Math.round((isGk ? 28 : isDef ? 55 : 45) * share * (0.7 + r() * 0.6));
    const passPct = isGk ? 0.7 + r() * 0.15 : isDef ? 0.82 + r() * 0.12 : 0.75 + r() * 0.15;
    const duels = Math.round((isGk ? 1 : 12) * share * (0.6 + r() * 0.8));
    const dribbles = isGk || isDef ? Math.round(r() * 2 * share * b) : Math.round((1 + r() * 5) * share * b);
    const shots = isGk ? 0 : Math.max(g, Math.round(xg * 7 + r() * 2 * share));
    const yellow = r() < 0.11 ? 1 : 0;
    const red = !yellow && r() < 0.008 ? 1 : 0;
    if (yellow) {
      const c = cardsByPlayer.get(p.externalId) ?? { yellow: 0, lastMatch: matchExternalId };
      cardsByPlayer.set(p.externalId, { yellow: c.yellow + 1, lastMatch: matchExternalId });
    }
    const conceded90 = isGk ? conceded : null;
    const psxgFaced = isGk ? round(conceded * (0.8 + r() * 0.5) * b + r() * 0.8, 3) : null;
    const saves = isGk ? Math.round(1 + r() * 5) : null;
    const rating = round(Math.min(10, Math.max(4.5, 6.4 + (b - 1) * 1.5 + g * 0.8 + a * 0.5 - (isGk ? conceded * 0.3 : 0) + (r() - 0.5) * 1.2)), 1);
    return {
      playerExternalId: p.externalId,
      matchExternalId,
      teamExternalId,
      minutes: mins,
      goals: g,
      assists: a,
      shots,
      shotsOnTarget: Math.min(shots, Math.max(g, Math.round(shots * (0.3 + r() * 0.3)))),
      xg,
      xa: isGk ? 0 : round((a > 0 ? 0.3 : 0) + r() * 0.25 * share * b, 3),
      passes,
      passesCompleted: Math.round(passes * passPct),
      keyPasses: isGk ? 0 : Math.round(r() * (p.position === "midfielder" ? 3 : 1.5) * share * b),
      duels,
      duelsWon: Math.min(duels, Math.round(duels * (0.4 + r() * 0.3) * Math.sqrt(b))),
      dribblesAttempted: dribbles,
      dribblesSuccessful: Math.round(dribbles * (0.4 + r() * 0.4)),
      dispossessed: isGk ? 0 : Math.round(r() * 3 * share),
      tackles: isGk ? 0 : Math.round((isDef ? 2.5 : 1.2) * r() * 2 * share),
      clearances: isDef ? Math.round((2 + r() * 5) * share * b) : Math.round(r() * share),
      errorsLeadingToGoal: r() < 0.015 ? 1 : 0,
      foulsCommitted: isGk ? 0 : Math.round(r() * 2.5 * share),
      yellowCards: yellow,
      redCards: red,
      rating,
      saves,
      goalsConceded: conceded90,
      psxgFaced,
      cleanSheet: isGk ? conceded === 0 && mins >= 60 : null,
    };
  });
}

/** Teamwerte je Spiel – aus den Spielerwerten summiert, damit alles zusammenpasst. */
function teamStatsForMatch(m: MatchRecord, stats: PlayerMatchStatsRecord[]): TeamMatchStatsRecord[] {
  const sides = [
    { team: m.homeTeam.externalId, goals: m.homeScore!, conceded: m.awayScore! },
    { team: m.awayTeam.externalId, goals: m.awayScore!, conceded: m.homeScore! },
  ];
  const sum = (team: string, pick: (s: PlayerMatchStatsRecord) => number | null) =>
    stats
      .filter((s) => s.matchExternalId === m.externalId && s.teamExternalId === team)
      .reduce((acc, s) => acc + (pick(s) ?? 0), 0);
  const passes = sides.map((x) => sum(x.team, (s) => s.passes));
  const xg = sides.map((x) => round(sum(x.team, (s) => s.xg), 3));
  return sides.map((x, i) => {
    const r = rng(`${m.externalId}-team-${x.team}`);
    const completed = sum(x.team, (s) => s.passesCompleted);
    const goalsByPeriod: Record<string, number> = Object.fromEntries(GOAL_PERIODS.map((p) => [p, 0]));
    for (let g = 0; g < x.goals; g++) {
      const p = GOAL_PERIODS[Math.floor(r() * GOAL_PERIODS.length)]!;
      goalsByPeriod[p]! += 1;
    }
    return {
      matchExternalId: m.externalId,
      teamExternalId: x.team,
      goals: x.goals,
      goalsConceded: x.conceded,
      xg: xg[i]!,
      xga: xg[1 - i]!,
      possessionPct: round((passes[i]! / (passes[0]! + passes[1]!)) * 100, 1),
      passes: passes[i]!,
      passAccuracyPct: passes[i]! ? round((completed / passes[i]!) * 100, 1) : null,
      shots: sum(x.team, (s) => s.shots),
      shotsOnTarget: sum(x.team, (s) => s.shotsOnTarget),
      corners: Math.round(2 + r() * 7),
      setPieceGoals: x.goals > 0 && r() < 0.3 ? 1 : 0,
      ppda: round(7 + r() * 8, 2),
      goalsByPeriod,
    };
  });
}

function oddsForMatch(m: MatchRecord, now: Date): OddsRecord[] {
  const hi = TEAMS.findIndex((t) => t.name === m.homeTeam.name);
  const ai = TEAMS.findIndex((t) => t.name === m.awayTeam.name);
  const diff = Math.log(TEAMS[hi]!.strength / TEAMS[ai]!.strength) + 0.25;
  const pHome = 1 / (1 + Math.exp(-1.6 * diff)) * 0.74;
  const pDraw = 0.26;
  const pAway = 1 - pHome - pDraw;
  const pOver = 0.52 + (TEAMS[hi]!.strength + TEAMS[ai]!.strength - 2) * 0.1;
  const out: OddsRecord[] = [];
  for (const [bookmakerKey, margin] of Object.entries(BOOKMAKER_MARGINS)) {
    const r = rng(`${m.externalId}-${bookmakerKey}`);
    // Kleine, absichtliche Abweichungen je Anbieter, damit es etwas zu vergleichen gibt.
    const noisy = (p: number) => p * (1 + (r() - 0.5) * 0.08);
    const price = (p: number) => round(1 / (noisy(p) * (1 + margin)), 2);
    const base = {
      match: { externalId: m.externalId, homeTeamName: m.homeTeam.name, awayTeamName: m.awayTeam.name, kickoffAt: m.kickoffAt },
      bookmakerKey,
      bookmakerUpdatedAt: new Date(now.getTime() - Math.floor(r() * 20) * 60_000),
    };
    out.push(
      { ...base, market: "h2h", selection: "home", line: null, price: price(pHome) },
      { ...base, market: "h2h", selection: "draw", line: null, price: price(pDraw) },
      { ...base, market: "h2h", selection: "away", line: null, price: price(pAway) },
      { ...base, market: "totals", selection: "over", line: 2.5, price: price(pOver) },
      { ...base, market: "totals", selection: "under", line: 2.5, price: price(1 - pOver) },
    );
  }
  return out;
}

// ---------------------------------------------------------------------------
// Provider-Fassade über die Testwelt
// ---------------------------------------------------------------------------

export class TestdatenProvider
  implements
    MatchProvider,
    PlayerProvider,
    InjuryProvider,
    SuspensionProvider,
    ContractProvider,
    BroadcastProvider,
    OddsProvider
{
  readonly key = "testdaten";
  private readonly world: TestWorld;
  private readonly provenance: Provenance;

  constructor(now: Date = new Date()) {
    this.world = buildTestWorld(now);
    this.provenance = { source: "testdaten", fetchedAt: now, sourceUrl: null };
  }

  isAvailable(): boolean {
    return true;
  }

  supports(competitionCode: string): boolean {
    return competitionCode === TEST_COMPETITION.code;
  }

  private tag<T>(items: T[]): Sourced<T>[] {
    return items.map((i) => ({ ...i, provenance: this.provenance }));
  }

  async getMatches() {
    return this.tag(this.world.matches);
  }
  async getSquad(teamExternalId: string) {
    return this.tag(this.world.players.filter((p) => p.teamExternalId === teamExternalId));
  }
  async getPlayerMatchStats() {
    return this.tag(this.world.stats);
  }
  async getTeamMatchStats() {
    return this.tag(this.world.teamStats);
  }
  async getLineups() {
    return this.tag(this.world.lineups);
  }
  async getInjuries() {
    return this.tag(this.world.injuries);
  }
  async getSuspensions() {
    return this.tag(this.world.suspensions);
  }
  async getContracts(teamExternalId: string) {
    return this.tag(this.world.contracts.filter((c) => c.teamExternalId === teamExternalId));
  }
  async getBroadcasts() {
    return this.tag(this.world.broadcasts);
  }
  async getOdds() {
    return this.tag(this.world.odds);
  }
  teams(): TeamRecord[] {
    return this.world.teams;
  }
}
