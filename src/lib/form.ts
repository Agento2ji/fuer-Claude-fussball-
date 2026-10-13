/**
 * Formbewertung nach Abschnitt 5 – nachvollziehbar gerechnet, keine KI.
 *
 * 1. Je Spiel und Kennzahl einen Wert pro 90 Minuten bilden (Quoten bleiben Quoten).
 * 2. Jeden Wert gegen die Verteilung derselben Positionsgruppe im selben
 *    Wettbewerb und derselben Saison z-standardisieren; Ligastärke addieren.
 * 3. Positionsabhängig gewichtet zu einem Spielwert zusammenfassen.
 * 4. Aktuelle Form = Mittel der letzten 5 Pflichtspiele mit ≥ 30 Minuten.
 * 5. Perzentil gegen alle gleich langen Abschnitte der erfassten Karriere → Stufe.
 *
 * Rein, ohne Datenbank; alle Parameter aus `src/config/form.ts`.
 */
import {
  FORM_TIERS,
  FORM_WEIGHTS,
  FORM_WINDOW,
  type FormMetric,
  type FormTierKey,
  LEAGUE_SHIFT_SD,
  LEAGUE_STRENGTH,
  SHORT_CAREER_WINDOWS,
  Z_CLIP,
} from "@/config/form";

export type PositionGroup = keyof typeof FORM_WEIGHTS;

/** Eine Spielerleistung in einem Spiel – Rohwerte aus `player_match_stats`. */
export interface PerformanceRow {
  matchId: number;
  kickoffAt: Date;
  competitionCode: string;
  season: string;
  position: PositionGroup;
  minutes: number;
  goals: number | null;
  assists: number | null;
  xg: number | null;
  xa: number | null;
  shotsOnTarget: number | null;
  keyPasses: number | null;
  dribblesSuccessful: number | null;
  duelsWon: number | null;
  tackles: number | null;
  clearances: number | null;
  passes: number | null;
  passesCompleted: number | null;
  errorsLeadingToGoal: number | null;
  saves: number | null;
  goalsConceded: number | null;
  psxgFaced: number | null;
}

type MetricValues = Partial<Record<FormMetric, number>>;

const per90 = (v: number | null, minutes: number) => (v === null || minutes <= 0 ? undefined : (v * 90) / minutes);

/** Schritt 1: Kennzahlen eines Spiels, auf 90 Minuten normiert. */
export function metricValues(r: PerformanceRow): MetricValues {
  const m = r.minutes;
  const out: MetricValues = {
    xg: per90(r.xg, m),
    xa: per90(r.xa, m),
    shotsOnTarget: per90(r.shotsOnTarget, m),
    keyPasses: per90(r.keyPasses, m),
    dribblesSuccessful: per90(r.dribblesSuccessful, m),
    scorerPoints: r.goals === null && r.assists === null ? undefined : per90((r.goals ?? 0) + (r.assists ?? 0), m),
    duelsWon: per90(r.duelsWon, m),
    tackles: per90(r.tackles, m),
    clearances: per90(r.clearances, m),
    passAccuracy: r.passes && r.passesCompleted !== null ? r.passesCompleted / r.passes : undefined,
    // Fehler vor Gegentor: Anzahl je Spiel, nicht hochgerechnet – ein Fehler bleibt ein Fehler.
    errorsLeadingToGoal: r.errorsLeadingToGoal ?? undefined,
    goalsPrevented:
      r.psxgFaced === null || r.goalsConceded === null ? undefined : per90(r.psxgFaced - r.goalsConceded, m),
    savePct:
      r.saves === null || r.goalsConceded === null || r.saves + r.goalsConceded === 0
        ? undefined
        : r.saves / (r.saves + r.goalsConceded),
  };
  for (const k of Object.keys(out) as FormMetric[]) if (out[k] === undefined) delete out[k];
  return out;
}

export interface Distribution {
  mean: number;
  sd: number;
  n: number;
}

export type ReferenceKey = `${string}|${string}|${PositionGroup}`;
export const referenceKey = (competitionCode: string, season: string, position: PositionGroup): ReferenceKey =>
  `${competitionCode}|${season}|${position}`;

/**
 * Schritt 2a: Verteilung je Kennzahl für Wettbewerb × Saison × Position.
 * Nur Einsätze mit genug Minuten, damit Kurzeinsätze die Verteilung nicht verzerren.
 */
export function buildReference(rows: PerformanceRow[]): Map<ReferenceKey, Partial<Record<FormMetric, Distribution>>> {
  const groups = new Map<ReferenceKey, Map<FormMetric, number[]>>();
  for (const r of rows) {
    if (r.minutes < FORM_WINDOW.minMinutes) continue;
    const key = referenceKey(r.competitionCode, r.season, r.position);
    let g = groups.get(key);
    if (!g) groups.set(key, (g = new Map()));
    for (const [metric, value] of Object.entries(metricValues(r)) as [FormMetric, number][]) {
      let list = g.get(metric);
      if (!list) g.set(metric, (list = []));
      list.push(value);
    }
  }
  const out = new Map<ReferenceKey, Partial<Record<FormMetric, Distribution>>>();
  for (const [key, g] of groups) {
    const dists: Partial<Record<FormMetric, Distribution>> = {};
    for (const [metric, values] of g) {
      const mean = values.reduce((a, b) => a + b, 0) / values.length;
      const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length;
      dists[metric] = { mean, sd: Math.sqrt(variance), n: values.length };
    }
    out.set(key, dists);
  }
  return out;
}

export interface MatchScore {
  matchId: number;
  kickoffAt: Date;
  minutes: number;
  /** Gewichteter Spielwert in Standardabweichungen (0 = Durchschnitt der Vergleichsgruppe). */
  score: number;
  /** Beitrag je Kennzahl zum Spielwert (Gewicht × z, bereits normiert). */
  contributions: Partial<Record<FormMetric, number>>;
}

/** Schritt 2b + 3: z-Werte und gewichteter Spielwert. */
export function scoreMatch(
  r: PerformanceRow,
  reference: Map<ReferenceKey, Partial<Record<FormMetric, Distribution>>>,
): MatchScore | null {
  const dists = reference.get(referenceKey(r.competitionCode, r.season, r.position));
  if (!dists) return null;
  const weights = FORM_WEIGHTS[r.position];
  const values = metricValues(r);
  const used: [FormMetric, number, number][] = [];
  for (const [metric, w] of Object.entries(weights) as [FormMetric, number][]) {
    const v = values[metric];
    const d = dists[metric];
    if (v === undefined || !d || d.n < 2) continue;
    const z = d.sd === 0 ? 0 : Math.max(-Z_CLIP, Math.min(Z_CLIP, (v - d.mean) / d.sd));
    used.push([metric, w, z]);
  }
  // Fehlt eine Kennzahl (z. B. keine xG-Quelle), verteilt sich ihr Gewicht auf die übrigen.
  const totalWeight = used.reduce((a, [, w]) => a + Math.abs(w), 0);
  if (totalWeight === 0) return null;
  const contributions: Partial<Record<FormMetric, number>> = {};
  let score = 0;
  for (const [metric, w, z] of used) {
    const c = (w * z) / totalWeight;
    contributions[metric] = c;
    score += c;
  }
  const strength = LEAGUE_STRENGTH[r.competitionCode] ?? 1;
  score += (strength - 1) * LEAGUE_SHIFT_SD;
  return { matchId: r.matchId, kickoffAt: r.kickoffAt, minutes: r.minutes, score, contributions };
}

export type FormResult =
  | {
      status: "ok";
      tier: FormTierKey;
      tierLabel: string;
      percentile: number;
      /** Aktueller Formwert (Mittel der Spielwerte) in Standardabweichungen. */
      value: number;
      matchesUsed: { matchId: number; kickoffAt: Date; score: number }[];
      drivers: { metric: FormMetric; contribution: number }[];
      careerWindows: number;
      shortCareer: boolean;
    }
  | {
      status: "zu-wenig-daten";
      reason: string;
      matchesUsed: { matchId: number; kickoffAt: Date; score: number }[];
      careerWindows: number;
    };

/** Schritt 5a: Perzentil (Anteil kleinerer Werte, Gleichstände zur Hälfte). */
export function percentileOf(value: number, sample: number[]): number {
  if (sample.length === 0) return NaN;
  let below = 0;
  let equal = 0;
  for (const s of sample) {
    if (s < value) below++;
    else if (s === value) equal++;
  }
  return ((below + equal / 2) / sample.length) * 100;
}

export function tierFor(percentile: number): (typeof FORM_TIERS)[number] {
  return (
    FORM_TIERS.find((t) => (t.inclusive ? percentile <= t.upTo : percentile < t.upTo)) ??
    FORM_TIERS[FORM_TIERS.length - 1]!
  );
}

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

/** Schritt 4 + 5: aktuelle Form gegen alle Karrierefenster. */
export function formRating(scores: MatchScore[], now: Date): FormResult {
  const qualified = scores
    .filter((s) => s.minutes >= FORM_WINDOW.minMinutes && s.kickoffAt <= now)
    .sort((a, b) => a.kickoffAt.getTime() - b.kickoffAt.getTime());

  const cutoff = now.getTime() - FORM_WINDOW.maxAgeDays * 86_400_000;
  const recent = qualified.filter((s) => s.kickoffAt.getTime() >= cutoff).slice(-FORM_WINDOW.matches);
  const matchesUsed = recent.map((s) => ({ matchId: s.matchId, kickoffAt: s.kickoffAt, score: s.score }));

  // Karriere-Abschnitte genauso lang wie das aktuelle Fenster: Ein Mittel aus
  // 3 Spielen schwankt stärker als eines aus 5 und landete sonst zu oft an den Rändern.
  const size = Math.max(recent.length, FORM_WINDOW.minMatches);
  const career: number[] = [];
  for (let i = size - 1; i < qualified.length; i++) {
    career.push(mean(qualified.slice(i - size + 1, i + 1).map((s) => s.score)));
  }

  if (recent.length < FORM_WINDOW.minMatches) {
    return {
      status: "zu-wenig-daten",
      reason: `Nur ${recent.length} ${recent.length === 1 ? "Spiel" : "Spiele"} mit mindestens ${FORM_WINDOW.minMinutes} Minuten in den letzten ${FORM_WINDOW.maxAgeDays} Tagen; nötig sind ${FORM_WINDOW.minMatches}.`,
      matchesUsed,
      careerWindows: career.length,
    };
  }
  if (career.length === 0) {
    return {
      status: "zu-wenig-daten",
      reason: `Für einen Karrierevergleich braucht es mindestens ${size} erfasste Spiele mit ${FORM_WINDOW.minMinutes}+ Minuten.`,
      matchesUsed,
      careerWindows: 0,
    };
  }

  const value = mean(recent.map((s) => s.score));
  const percentile = percentileOf(value, career);
  const tier = tierFor(percentile);

  // Die zwei Kennzahlen, die den aktuellen Wert am stärksten bewegen (nach Betrag).
  const sums = new Map<FormMetric, number>();
  for (const s of recent) {
    for (const [m, c] of Object.entries(s.contributions) as [FormMetric, number][]) {
      sums.set(m, (sums.get(m) ?? 0) + c / recent.length);
    }
  }
  const drivers = [...sums.entries()]
    .map(([metric, contribution]) => ({ metric, contribution }))
    .sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution))
    .slice(0, 2);

  return {
    status: "ok",
    tier: tier.key,
    tierLabel: tier.label,
    percentile,
    value,
    matchesUsed,
    drivers,
    careerWindows: career.length,
    shortCareer: career.length < SHORT_CAREER_WINDOWS,
  };
}

/** Komplette Kette für einen Spieler: Rohzeilen → Formergebnis. */
export function computeForm(
  playerRows: PerformanceRow[],
  referenceRows: PerformanceRow[],
  now: Date,
): FormResult {
  const reference = buildReference(referenceRows);
  const scores = playerRows
    .map((r) => scoreMatch(r, reference))
    .filter((s): s is MatchScore => s !== null);
  return formRating(scores, now);
}
