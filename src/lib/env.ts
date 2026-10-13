import { z } from "zod";

/**
 * Serverseitige Umgebungsvariablen. Anbieter-Keys sind optional: Fehlt ein
 * Key, wird der Anbieter nicht abgefragt – es werden aber keine Daten
 * erfunden.
 */
const serverEnvSchema = z.object({
  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
  API_FOOTBALL_KEY: z.string().min(1).optional(),
  FOOTBALL_DATA_API_KEY: z.string().min(1).optional(),
  THE_ODDS_API_KEY: z.string().min(1).optional(),
  UPSTASH_REDIS_REST_URL: z.url().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().min(1).optional(),
  SCRAPER_CONTACT_EMAIL: z.email().optional(),
  SITE_USER: z.string().min(1).optional(),
  SITE_PASSWORD: z.string().min(12, "SITE_PASSWORD muss mindestens 12 Zeichen haben").optional(),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

export function parseServerEnv(
  source: Record<string, string | undefined>,
): ServerEnv {
  // Leere Strings aus .env-Dateien wie „nicht gesetzt“ behandeln.
  const cleaned = Object.fromEntries(
    Object.entries(source).filter(([, v]) => v !== undefined && v !== ""),
  );
  const result = serverEnvSchema.safeParse(cleaned);
  if (!result.success) {
    const details = result.error.issues
      .map((i) => `  ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`Ungültige Umgebungsvariablen:\n${details}`);
  }
  return result.data;
}

let cached: ServerEnv | undefined;

export function serverEnv(): ServerEnv {
  cached ??= parseServerEnv(process.env);
  return cached;
}
