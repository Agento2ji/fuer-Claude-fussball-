/**
 * Entfernen der Buchmachermarge („Devigging“) für einen vollständigen Markt
 * (alle Ausgänge eines Marktes vom selben Buchmacher). Rein, ohne Abhängigkeiten.
 *
 * - proportional: implizite Wahrscheinlichkeiten auf Summe 1 skaliert.
 *   Einfach, verteilt die Marge aber gleichmäßig – unterschätzt den
 *   Favoriten-Außenseiter-Effekt.
 * - power: p_i = π_i^k mit k so, dass Σ p_i = 1. Zieht Außenseitern mehr
 *   Marge ab als Favoriten.
 * - shin: Modell mit Anteil z „informierter“ Wetter (Shin 1993). Ebenfalls
 *   außenseiterlastige Marge, theoretisch begründet.
 */
export type DevigMethod = "proportional" | "power" | "shin";

export const DEVIG_LABEL: Record<DevigMethod, string> = {
  proportional: "Proportional",
  power: "Power",
  shin: "Shin",
};

/** Implizite Wahrscheinlichkeiten 1/Quote. */
export const implied = (odds: number[]) => odds.map((o) => 1 / o);

/** Buchmachermarge: Σ 1/Quote − 1 (0,05 = 5 %). */
export const margin = (odds: number[]) => implied(odds).reduce((a, b) => a + b, 0) - 1;

function assertOdds(odds: number[]) {
  if (odds.length < 2 || odds.some((o) => !Number.isFinite(o) || o <= 1)) {
    throw new Error(`Ungültiger Markt: ${odds.join(", ")}`);
  }
}

function bisect(f: (x: number) => number, lo: number, hi: number, iterations = 100): number {
  let a = lo;
  let b = hi;
  for (let i = 0; i < iterations; i++) {
    const mid = (a + b) / 2;
    if (f(a) * f(mid) <= 0) b = mid;
    else a = mid;
  }
  return (a + b) / 2;
}

export function devigProportional(odds: number[]): number[] {
  assertOdds(odds);
  const pi = implied(odds);
  const s = pi.reduce((a, b) => a + b, 0);
  return pi.map((p) => p / s);
}

export function devigPower(odds: number[]): number[] {
  assertOdds(odds);
  const pi = implied(odds);
  // Ohne Marge (oder Arbitrage) ist nichts zu entfernen.
  if (margin(odds) <= 0) return devigProportional(odds);
  const k = bisect((k) => pi.reduce((a, p) => a + p ** k, 0) - 1, 1, 50);
  const p = pi.map((x) => x ** k);
  const s = p.reduce((a, b) => a + b, 0);
  return p.map((x) => x / s);
}

export function devigShin(odds: number[]): number[] {
  assertOdds(odds);
  const pi = implied(odds);
  const s = pi.reduce((a, b) => a + b, 0);
  if (s <= 1) return devigProportional(odds);
  const probs = (z: number) => pi.map((p) => (Math.sqrt(z * z + (4 * (1 - z) * p * p) / s) - z) / (2 * (1 - z)));
  const z = bisect((z) => probs(z).reduce((a, b) => a + b, 0) - 1, 0, 0.999);
  const p = probs(z);
  const sum = p.reduce((a, b) => a + b, 0);
  return p.map((x) => x / sum);
}

export function devig(odds: number[], method: DevigMethod): number[] {
  return method === "power" ? devigPower(odds) : method === "shin" ? devigShin(odds) : devigProportional(odds);
}
