import type { ZodType } from "zod";
import { RATE_LIMITS } from "@/config/providers";
import { type Cache, getCache } from "./cache";
import { getBucket } from "./rate-limit";
import { ProviderError } from "./types";

export interface FetchJsonOptions<T> {
  provider: string;
  url: string;
  schema: ZodType<T>;
  headers?: Record<string, string>;
  /** Cache-Dauer in Sekunden; 0 = nicht cachen. */
  ttlSeconds: number;
  timeoutMs?: number;
  maxRetries?: number;
  /** Für Tests austauschbar. */
  fetchImpl?: typeof fetch;
  cache?: Cache;
  sleep?: (ms: number) => Promise<void>;
  now?: () => Date;
}

export interface FetchJsonResult<T> {
  data: T;
  /** Zeitpunkt des echten Abrufs – bei Cache-Treffern der ursprüngliche. */
  fetchedAt: Date;
  fromCache: boolean;
  /** Ausgewählte Antwort-Header, z. B. das Quoten-Kontingent. */
  headers: Record<string, string>;
}

interface CachedResponse {
  body: unknown;
  fetchedAt: string;
  headers: Record<string, string>;
}

const KEPT_HEADERS = [
  "x-requests-remaining",
  "x-requests-used",
  "x-requests-last",
  "x-requests-available",
];

/** Entfernt Zugangsdaten aus URLs, bevor sie geloggt oder als Cache-Key genutzt werden. */
export function redactUrl(url: string): string {
  return url.replace(/([?&](?:apiKey|api_key|key|token)=)[^&]*/gi, "$1***");
}

export function userAgent(): string {
  const contact = process.env.SCRAPER_CONTACT_EMAIL;
  return contact
    ? `fussball-hub/0.1 (+mailto:${contact})`
    : "fussball-hub/0.1 (privates Lernprojekt)";
}

const isRetryable = (status: number) => status === 429 || status >= 500;

function backoffMs(attempt: number, retryAfter: string | null): number {
  const seconds = retryAfter ? Number(retryAfter) : NaN;
  if (Number.isFinite(seconds) && seconds >= 0) {
    return Math.min(seconds * 1000, 60_000);
  }
  const base = 500 * 2 ** attempt;
  return Math.min(base + Math.random() * base * 0.2, 30_000);
}

/**
 * Holt JSON von einem Anbieter: mit Cache, Rate-Limit, Timeout,
 * exponentiellem Backoff und Zod-Validierung. Ungültige Antworten werden
 * nie durchgereicht, sondern als `ProviderError` gemeldet.
 */
export async function fetchJson<T>(
  opts: FetchJsonOptions<T>,
): Promise<FetchJsonResult<T>> {
  const {
    provider,
    url,
    schema,
    ttlSeconds,
    timeoutMs = 15_000,
    maxRetries = 3,
    fetchImpl = fetch,
    cache = getCache(),
    sleep = (ms) => new Promise((r) => setTimeout(r, ms)),
    now = () => new Date(),
  } = opts;
  const safeUrl = redactUrl(url);
  const cacheKey = `http:${provider}:${safeUrl}`;

  const parse = (body: unknown) => {
    const result = schema.safeParse(body);
    if (!result.success) {
      const issue = result.error.issues[0];
      throw new ProviderError(
        provider,
        `Antwort von ${safeUrl} entspricht nicht dem erwarteten Format (${issue?.path.join(".")}: ${issue?.message})`,
        result.error,
      );
    }
    return result.data;
  };

  if (ttlSeconds > 0) {
    const cached = await cache.get<CachedResponse>(cacheKey);
    if (cached) {
      return {
        data: parse(cached.body),
        fetchedAt: new Date(cached.fetchedAt),
        fromCache: true,
        headers: cached.headers,
      };
    }
  }

  const limit = RATE_LIMITS[provider];
  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (limit) await getBucket(provider, limit).take();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetchImpl(url, {
        headers: {
          Accept: "application/json",
          "User-Agent": userAgent(),
          ...opts.headers,
        },
        signal: controller.signal,
      });
      if (!res.ok) {
        lastError = new ProviderError(
          provider,
          `HTTP ${res.status} bei ${safeUrl}`,
        );
        if (isRetryable(res.status) && attempt < maxRetries) {
          await sleep(backoffMs(attempt, res.headers.get("retry-after")));
          continue;
        }
        throw lastError;
      }
      const body: unknown = await res.json();
      const data = parse(body);
      const fetchedAt = now();
      const headers: Record<string, string> = {};
      for (const h of KEPT_HEADERS) {
        const v = res.headers.get(h);
        if (v !== null) headers[h] = v;
      }
      if (ttlSeconds > 0) {
        await cache.set<CachedResponse>(
          cacheKey,
          { body, fetchedAt: fetchedAt.toISOString(), headers },
          ttlSeconds,
        );
      }
      return { data, fetchedAt, fromCache: false, headers };
    } catch (err) {
      if (err instanceof ProviderError) throw err;
      // Netzwerkfehler oder Timeout: erneut versuchen.
      lastError = err;
      if (attempt < maxRetries) {
        await sleep(backoffMs(attempt, null));
        continue;
      }
    } finally {
      clearTimeout(timer);
    }
  }

  throw new ProviderError(
    provider,
    `Abruf von ${safeUrl} nach ${maxRetries + 1} Versuchen fehlgeschlagen`,
    lastError,
  );
}
