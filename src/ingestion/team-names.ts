/**
 * Normalisierung von Vereinsnamen, damit dieselbe Mannschaft über
 * verschiedene Quellen zusammenfindet („FC Bayern München“, „Bayern Munich“).
 */

/** Wörter ohne Unterscheidungskraft, die beim Vergleich wegfallen. */
const NOISE = new Set([
  "fc", "sc", "sv", "ac", "as", "ss", "cf", "cd", "ca", "rc", "ud", "sd",
  "vfb", "vfl", "tsg", "bsc", "fsv", "afc", "ogc", "acf", "ssc", "us", "rcd",
  "club", "de", "del", "la", "le", "olympique", "calcio", "football", "futbol",
  "1", "04", "05", "07", "09", "1846", "1848", "1860", "1893", "1899", "1900",
  "1907", "1909", "1913", "1919",
]);

/** Übersetzte Ortsnamen, Wort für Wort. */
const TOKEN_ALIASES: Record<string, string> = {
  munich: "munchen",
  cologne: "koln",
  milano: "milan",
  turin: "torino",
};

/** Feste Zuordnungen ganzer Namen, wo Normalisierung nicht reicht. */
const ALIASES: Record<string, string> = {
  "inter milan": "internazionale milano",
  "inter milano": "internazionale milano",
  inter: "internazionale milano",
  "ac milan": "milan",
  psg: "paris saint germain",
  "man united": "manchester united",
  "man city": "manchester city",
  "nottm forest": "nottingham forest",
  spurs: "tottenham hotspur",
  tottenham: "tottenham hotspur",
  wolves: "wolverhampton wanderers",
  "borussia monchengladbach": "monchengladbach",
  gladbach: "monchengladbach",
  "rb leipzig": "leipzig",
  "rasenballsport leipzig": "leipzig",
};

export function normalizeTeamName(name: string): string {
  const ascii = name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/ß/g, "ss")
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const aliased = ALIASES[ascii] ?? ascii;
  const tokens = aliased
    .split(" ")
    .filter((t) => t && !NOISE.has(t))
    .map((t) => TOKEN_ALIASES[t] ?? t);
  const joined = tokens.join(" ");
  return ALIASES[joined] ?? joined;
}

/**
 * true, wenn zwei Namen dieselbe Mannschaft meinen können: exakt gleich nach
 * Normalisierung, oder ein Name ist vollständig im anderen enthalten
 * (z. B. „Leverkusen“ in „Bayer Leverkusen“). Aufrufer müssen prüfen, dass
 * genau ein Kandidat passt – siehe `findTeam`.
 */
export function sameTeam(a: string, b: string): boolean {
  const na = normalizeTeamName(a);
  const nb = normalizeTeamName(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  const ta = new Set(na.split(" "));
  const tb = new Set(nb.split(" "));
  const [small, large] = ta.size <= tb.size ? [ta, tb] : [tb, ta];
  return [...small].every((t) => large.has(t));
}

/**
 * Sucht in `candidates` die eine Mannschaft, die zu `name` passt. Exakte
 * Treffer gehen vor; bei mehreren gleich guten Treffern wird bewusst keiner
 * gewählt (Mehrdeutigkeit wird vom Aufrufer geloggt, nicht geraten).
 */
export function findTeam<T extends { name: string }>(
  name: string,
  candidates: readonly T[],
): T | undefined {
  const n = normalizeTeamName(name);
  const exact = candidates.filter((c) => normalizeTeamName(c.name) === n);
  if (exact.length === 1) return exact[0];
  if (exact.length > 1) return undefined;
  const loose = candidates.filter((c) => sameTeam(name, c.name));
  return loose.length === 1 ? loose[0] : undefined;
}
