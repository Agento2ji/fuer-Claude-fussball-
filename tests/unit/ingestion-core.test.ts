import { describe, expect, it } from "vitest";
import { z } from "zod";
import { MemoryCache } from "@/ingestion/cache";
import { withFallback } from "@/ingestion/fallback";
import { fetchJson, redactUrl } from "@/ingestion/http";
import { TokenBucket } from "@/ingestion/rate-limit";
import { findTeam, normalizeTeamName, sameTeam } from "@/ingestion/team-names";
import { ProviderError } from "@/ingestion/types";
import { zonedTimeToUtc } from "@/lib/time";

const noSleep = async () => {};

function fakeFetch(responses: (() => Response)[]) {
  let i = 0;
  const calls: string[] = [];
  const impl = (async (url: string) => {
    calls.push(String(url));
    const next = responses[Math.min(i++, responses.length - 1)]!;
    return next();
  }) as unknown as typeof fetch;
  return { impl, calls };
}

describe("fetchJson", () => {
  const schema = z.object({ ok: z.boolean() });

  it("wiederholt bei 429 und 5xx und liefert dann", async () => {
    const f = fakeFetch([
      () => new Response("", { status: 429, headers: { "retry-after": "0" } }),
      () => new Response("", { status: 503 }),
      () => new Response(JSON.stringify({ ok: true }), { status: 200 }),
    ]);
    const res = await fetchJson({
      provider: "test", url: "https://x.invalid/a", schema, ttlSeconds: 0,
      fetchImpl: f.impl, sleep: noSleep, cache: new MemoryCache(),
    });
    expect(res.data.ok).toBe(true);
    expect(f.calls).toHaveLength(3);
  });

  it("wiederholt nicht bei 4xx und meldet einen ProviderError", async () => {
    const f = fakeFetch([() => new Response("", { status: 401 })]);
    await expect(
      fetchJson({ provider: "test", url: "https://x.invalid/b", schema, ttlSeconds: 0, fetchImpl: f.impl, sleep: noSleep, cache: new MemoryCache() }),
    ).rejects.toBeInstanceOf(ProviderError);
    expect(f.calls).toHaveLength(1);
  });

  it("lässt ungültige Antworten nie durch", async () => {
    const f = fakeFetch([() => new Response(JSON.stringify({ ok: "ja" }), { status: 200 })]);
    await expect(
      fetchJson({ provider: "test", url: "https://x.invalid/c", schema, ttlSeconds: 0, fetchImpl: f.impl, sleep: noSleep, cache: new MemoryCache() }),
    ).rejects.toThrow(/erwarteten Format/);
  });

  it("liefert aus dem Cache mit dem ursprünglichen Abrufzeitpunkt", async () => {
    const f = fakeFetch([() => new Response(JSON.stringify({ ok: true }), { status: 200 })]);
    const cache = new MemoryCache();
    const t0 = new Date("2026-10-13T10:00:00Z");
    const opts = { provider: "test", url: "https://x.invalid/d", schema, ttlSeconds: 60, fetchImpl: f.impl, sleep: noSleep, cache };
    const first = await fetchJson({ ...opts, now: () => t0 });
    const second = await fetchJson({ ...opts, now: () => new Date("2026-10-13T10:00:30Z") });
    expect(first.fromCache).toBe(false);
    expect(second.fromCache).toBe(true);
    expect(second.fetchedAt.toISOString()).toBe(t0.toISOString());
    expect(f.calls).toHaveLength(1);
  });

  it("entfernt API-Keys aus URLs", () => {
    expect(redactUrl("https://a.invalid/x?apiKey=geheim&markets=h2h")).toBe(
      "https://a.invalid/x?apiKey=***&markets=h2h",
    );
  });
});

describe("withFallback", () => {
  const provider = (key: string, available: boolean, result: () => Promise<string>) => ({
    key,
    isAvailable: () => available,
    get: result,
  });

  it("überspringt nicht verfügbare und fehlerhafte Anbieter und protokolliert das", async () => {
    const res = await withFallback(
      [
        provider("ohne-key", false, async () => "a"),
        provider("kaputt", true, async () => { throw new Error("down"); }),
        provider("gut", true, async () => "c"),
      ],
      (p) => p.get(),
    );
    expect(res.provider).toBe("gut");
    expect(res.result).toBe("c");
    expect(res.attempts.map((a) => a.outcome)).toEqual(["nicht verfügbar", "fehlgeschlagen", "ok"]);
  });

  it("liefert null, wenn keiner liefert", async () => {
    const res = await withFallback([provider("x", false, async () => "a")], (p) => p.get());
    expect(res.result).toBeNull();
  });
});

describe("TokenBucket", () => {
  it("wartet, wenn das Kontingent erschöpft ist", async () => {
    let now = 0;
    const waits: number[] = [];
    const bucket = new TokenBucket(2, 1000, () => now, async (ms) => { waits.push(ms); now += ms; });
    await bucket.take();
    await bucket.take();
    await bucket.take();
    expect(waits).toEqual([500]);
  });
});

describe("Teamnamen", () => {
  it("findet dieselbe Mannschaft über Sprachen und Schreibweisen", () => {
    expect(normalizeTeamName("FC Bayern München")).toBe(normalizeTeamName("Bayern Munich"));
    expect(sameTeam("1. FC Köln", "FC Cologne")).toBe(true);
    expect(sameTeam("Bayer 04 Leverkusen", "Bayer Leverkusen")).toBe(true);
    expect(sameTeam("FC Internazionale Milano", "Inter Milan")).toBe(true);
    expect(sameTeam("Paris Saint-Germain FC", "PSG")).toBe(true);
  });

  it("ordnet Ligue-1-Vereinsnamen den Städtenamen der Quoten zu", () => {
    expect(sameTeam("Stade Brestois 29", "Brest")).toBe(true);
    expect(sameTeam("Stade Rennais FC 1901", "Rennes")).toBe(true);
    expect(sameTeam("Olympique Lyonnais", "Lyon")).toBe(true);
    expect(sameTeam("Olympique Lyonnais", "Olympique de Marseille")).toBe(false);
    expect(sameTeam("Deportivo Alavés", "Alavés")).toBe(true);
  });

  it("verwechselt keine Stadtrivalen bei exakten Treffern", () => {
    const teams = [
      { name: "FC Internazionale Milano" },
      { name: "AC Milan" },
      { name: "FC Barcelona" },
      { name: "RCD Espanyol de Barcelona" },
      { name: "Paris FC" },
      { name: "Paris Saint-Germain FC" },
    ];
    expect(findTeam("AC Milan", teams)?.name).toBe("AC Milan");
    expect(findTeam("Inter", teams)?.name).toBe("FC Internazionale Milano");
    expect(findTeam("Barcelona", teams)?.name).toBe("FC Barcelona");
    expect(findTeam("Espanyol", teams)?.name).toBe("RCD Espanyol de Barcelona");
    expect(findTeam("Paris FC", teams)?.name).toBe("Paris FC");
    expect(findTeam("Paris Saint Germain", teams)?.name).toBe("Paris Saint-Germain FC");
  });

  it("wählt bei Mehrdeutigkeit keinen Kandidaten", () => {
    const teams = [{ name: "Manchester United FC" }, { name: "Manchester City FC" }];
    expect(findTeam("Manchester", teams)).toBeUndefined();
  });
});

describe("zonedTimeToUtc", () => {
  it("berücksichtigt Sommer- und Winterzeit", () => {
    expect(zonedTimeToUtc("2026-08-29", "15:30", "Europe/Berlin").toISOString()).toBe("2026-08-29T13:30:00.000Z");
    expect(zonedTimeToUtc("2026-12-05", "15:30", "Europe/Berlin").toISOString()).toBe("2026-12-05T14:30:00.000Z");
    expect(zonedTimeToUtc("2026-12-05", "15:00", "Europe/London").toISOString()).toBe("2026-12-05T15:00:00.000Z");
  });

  it("stimmt am Tag der Zeitumstellung", () => {
    // 25.10.2026: Umstellung um 03:00 MESZ auf 02:00 MEZ
    expect(zonedTimeToUtc("2026-10-25", "15:30", "Europe/Berlin").toISOString()).toBe("2026-10-25T14:30:00.000Z");
    expect(zonedTimeToUtc("2027-03-28", "15:30", "Europe/Berlin").toISOString()).toBe("2027-03-28T13:30:00.000Z");
  });
});
