import type { ProviderBase } from "./types";

export interface FallbackAttempt {
  provider: string;
  outcome: "nicht verfügbar" | "nicht unterstützt" | "fehlgeschlagen" | "ok";
  error?: string;
}

export interface FallbackResult<R> {
  /** Anbieter, dessen Ergebnis verwendet wurde; null = keiner lieferte. */
  provider: string | null;
  result: R | null;
  attempts: FallbackAttempt[];
}

/**
 * Fragt die Anbieter der Reihe nach, bis einer liefert. Fehler und
 * übersprungene Anbieter werden protokolliert, nicht verschluckt.
 */
export async function withFallback<P extends ProviderBase, R>(
  providers: readonly P[],
  call: (provider: P) => Promise<R>,
  supports: (provider: P) => boolean = () => true,
): Promise<FallbackResult<R>> {
  const attempts: FallbackAttempt[] = [];
  for (const provider of providers) {
    if (!provider.isAvailable()) {
      attempts.push({ provider: provider.key, outcome: "nicht verfügbar" });
      continue;
    }
    if (!supports(provider)) {
      attempts.push({ provider: provider.key, outcome: "nicht unterstützt" });
      continue;
    }
    try {
      const result = await call(provider);
      attempts.push({ provider: provider.key, outcome: "ok" });
      return { provider: provider.key, result, attempts };
    } catch (err) {
      attempts.push({
        provider: provider.key,
        outcome: "fehlgeschlagen",
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
  return { provider: null, result: null, attempts };
}
