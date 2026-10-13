import { Redis } from "@upstash/redis";

/**
 * Cache für Rohantworten der Anbieter. Mit Upstash-Zugangsdaten wird Redis
 * genutzt, sonst ein Speicher-Cache im Prozess (reicht lokal).
 */
export interface Cache {
  get<T>(key: string): Promise<T | undefined>;
  set<T>(key: string, value: T, ttlSeconds: number): Promise<void>;
}

export class MemoryCache implements Cache {
  private store = new Map<string, { value: unknown; expiresAt: number }>();

  constructor(private now: () => number = Date.now) {}

  async get<T>(key: string): Promise<T | undefined> {
    const hit = this.store.get(key);
    if (!hit) return undefined;
    if (hit.expiresAt <= this.now()) {
      this.store.delete(key);
      return undefined;
    }
    return hit.value as T;
  }

  async set<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    this.store.set(key, { value, expiresAt: this.now() + ttlSeconds * 1000 });
  }
}

export class UpstashCache implements Cache {
  constructor(private redis: Redis) {}

  async get<T>(key: string): Promise<T | undefined> {
    const value = await this.redis.get<T>(key);
    return value ?? undefined;
  }

  async set<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    await this.redis.set(key, value, { ex: ttlSeconds });
  }
}

let shared: Cache | undefined;

export function getCache(): Cache {
  if (!shared) {
    const url = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;
    shared =
      url && token
        ? new UpstashCache(new Redis({ url, token }))
        : new MemoryCache();
  }
  return shared;
}
