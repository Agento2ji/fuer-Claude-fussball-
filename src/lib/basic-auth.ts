/**
 * Prüft einen HTTP-Basic-Auth-Header. Rein, ohne Abhängigkeiten, damit er in
 * der Middleware (Edge-Runtime) und in Tests läuft.
 */
export function isAuthorized(
  header: string | null,
  expectedUser: string,
  expectedPassword: string,
): boolean {
  if (!header?.startsWith("Basic ")) return false;
  let decoded: string;
  try {
    decoded = atob(header.slice(6).trim());
  } catch {
    return false;
  }
  const sep = decoded.indexOf(":");
  if (sep < 0) return false;
  return safeEqual(decoded.slice(0, sep), expectedUser) && safeEqual(decoded.slice(sep + 1), expectedPassword);
}

/** Vergleich mit konstanter Laufzeit, damit die Antwortzeit nichts verrät. */
function safeEqual(a: string, b: string): boolean {
  const len = Math.max(a.length, b.length);
  let diff = a.length ^ b.length;
  for (let i = 0; i < len; i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}
