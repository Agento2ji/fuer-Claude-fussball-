/**
 * Reine Ableitungen für die Spielerseite – ohne Datenbank, gut testbar.
 */

export type PlayerStatusKind =
  | "einsatzbereit"
  | "verletzt"
  | "angeschlagen"
  | "gelbsperre"
  | "gelb-rot-sperre"
  | "rotsperre"
  | "gesperrt"
  | "nicht-im-kader";

export type Traffic = "ok" | "warn" | "danger";

export interface StatusInput {
  activeInjury: { status: "injured" | "doubtful" } | null;
  activeSuspension: {
    reason: "yellow_accumulation" | "yellow_red" | "red" | "other";
  } | null;
}

export function playerStatus(input: StatusInput): {
  kind: PlayerStatusKind;
  label: string;
  traffic: Traffic;
} {
  const s = input.activeSuspension;
  if (s) {
    const map = {
      yellow_accumulation: ["gelbsperre", "Gelbsperre"],
      yellow_red: ["gelb-rot-sperre", "Gelb-Rot-Sperre"],
      red: ["rotsperre", "Rotsperre"],
      other: ["gesperrt", "Gesperrt"],
    } as const;
    const [kind, label] = map[s.reason];
    return { kind, label, traffic: "danger" };
  }
  if (input.activeInjury?.status === "injured") {
    return { kind: "verletzt", label: "Verletzt", traffic: "danger" };
  }
  if (input.activeInjury?.status === "doubtful") {
    return { kind: "angeschlagen", label: "Angeschlagen", traffic: "warn" };
  }
  return { kind: "einsatzbereit", label: "Einsatzbereit", traffic: "ok" };
}

/**
 * Gelbe Karten bis zur nächsten Sperre. Gesperrt wird bei jedem Vielfachen
 * der Grenze (Bundesliga: 5., 10., 15. Gelbe). `threshold` null = Regel des
 * Wettbewerbs nicht hinterlegt, dann wird kein Abstand berechnet.
 */
export function yellowCardRisk(
  yellowCards: number,
  threshold: number | null,
): { untilSuspension: number | null; atRisk: boolean } {
  if (!threshold) return { untilSuspension: null, atRisk: false };
  const untilSuspension = threshold - (yellowCards % threshold);
  return { untilSuspension, atRisk: untilSuspension === 1 };
}

/** Volle Monate von `from` bis `to` (ISO-Datum), nie negativ. */
export function monthsBetween(from: Date, to: string): number {
  const end = new Date(`${to}T00:00:00Z`);
  let months =
    (end.getUTCFullYear() - from.getUTCFullYear()) * 12 +
    (end.getUTCMonth() - from.getUTCMonth());
  if (end.getUTCDate() < from.getUTCDate()) months -= 1;
  return Math.max(0, months);
}

export function age(birthDate: string, now: Date): number {
  const b = new Date(`${birthDate}T00:00:00Z`);
  let years = now.getUTCFullYear() - b.getUTCFullYear();
  const beforeBirthday =
    now.getUTCMonth() < b.getUTCMonth() ||
    (now.getUTCMonth() === b.getUTCMonth() && now.getUTCDate() < b.getUTCDate());
  if (beforeBirthday) years -= 1;
  return years;
}

export interface StatLine {
  minutes: number;
  goals: number | null;
  assists: number | null;
  shots: number | null;
  shotsOnTarget: number | null;
  xg: number | null;
  xa: number | null;
  passes: number | null;
  passesCompleted: number | null;
  keyPasses: number | null;
  duels: number | null;
  duelsWon: number | null;
  dribblesSuccessful: number | null;
  rating: number | null;
  saves: number | null;
  goalsConceded: number | null;
  psxgFaced: number | null;
}

export interface StatSummary {
  matches: number;
  minutes: number;
  goals: number;
  assists: number;
  xg: number | null;
  xa: number | null;
  shotsOnTarget: number;
  keyPasses: number;
  passAccuracy: number | null;
  duelRate: number | null;
  rating: number | null;
  saves: number;
  goalsConceded: number;
  /** Verhinderte Tore = PSxG gegen − Gegentore (positiv = gut). */
  goalsPrevented: number | null;
}

const sum = (xs: (number | null)[]) => xs.reduce<number>((a, b) => a + (b ?? 0), 0);
const allNull = (xs: (number | null)[]) => xs.every((x) => x === null);

/** Fasst mehrere Spiele zusammen. Quoten werden aus Summen gebildet, nicht gemittelt. */
export function summarize(lines: StatLine[]): StatSummary {
  const passes = sum(lines.map((l) => l.passes));
  const completed = sum(lines.map((l) => l.passesCompleted));
  const duels = sum(lines.map((l) => l.duels));
  const duelsWon = sum(lines.map((l) => l.duelsWon));
  const ratings = lines.map((l) => l.rating).filter((r): r is number => r !== null);
  const psxg = lines.map((l) => l.psxgFaced);
  return {
    matches: lines.length,
    minutes: sum(lines.map((l) => l.minutes)),
    goals: sum(lines.map((l) => l.goals)),
    assists: sum(lines.map((l) => l.assists)),
    xg: allNull(lines.map((l) => l.xg)) ? null : sum(lines.map((l) => l.xg)),
    xa: allNull(lines.map((l) => l.xa)) ? null : sum(lines.map((l) => l.xa)),
    shotsOnTarget: sum(lines.map((l) => l.shotsOnTarget)),
    keyPasses: sum(lines.map((l) => l.keyPasses)),
    passAccuracy: passes > 0 ? completed / passes : null,
    duelRate: duels > 0 ? duelsWon / duels : null,
    rating: ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : null,
    saves: sum(lines.map((l) => l.saves)),
    goalsConceded: sum(lines.map((l) => l.goalsConceded)),
    goalsPrevented: allNull(psxg) ? null : sum(psxg) - sum(lines.map((l) => l.goalsConceded)),
  };
}
