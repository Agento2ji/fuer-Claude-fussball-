import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  type FootballDataMatches,
  footballDataMatchesSchema,
  parseFootballData,
} from "@/ingestion/providers/football-data";
import {
  OpenfootballProvider,
  openfootballFileSchema,
  openfootballUrl,
  parseOpenfootball,
} from "@/ingestion/providers/openfootball";
import { oddsApiResponseSchema, parseOddsApi } from "@/ingestion/providers/the-odds-api";
import { MemoryCache } from "@/ingestion/cache";

const fetchedAt = new Date("2026-10-13T12:00:00Z");

describe("openfootball", () => {
  const raw = JSON.parse(
    readFileSync("tests/fixtures/openfootball-de1-auszug.json", "utf8"),
  );
  const file = openfootballFileSchema.parse(raw);
  const records = parseOpenfootball(
    file,
    { code: "BL1", timezone: "Europe/Berlin" },
    "2026/27",
    fetchedAt,
    "https://example.invalid/de.1.json",
  );

  it("liest Ergebnisse als Objekt { ht, ft }", () => {
    expect(records[0]).toMatchObject({
      homeTeam: { name: "FC Bayern München" },
      awayTeam: { name: "VfB Stuttgart" },
      homeScore: 5,
      awayScore: 1,
      status: "finished",
      matchday: 1,
    });
  });

  it("liest Ergebnisse als reines Paar [h, a]", () => {
    expect(records[1]).toMatchObject({ homeScore: 0, awayScore: 0, status: "finished" });
  });

  it("lässt offene Spiele ohne Ergebnis", () => {
    expect(records[2]).toMatchObject({ homeScore: null, awayScore: null, status: "scheduled" });
  });

  it("rechnet Ortszeit in UTC um (Sommerzeit)", () => {
    // 28.08.2026 20:30 Berlin = 18:30 UTC
    expect(records[0]!.kickoffAt.toISOString()).toBe("2026-08-28T18:30:00.000Z");
    expect(records[0]!.kickoffTimeKnown).toBe(true);
  });

  it("markiert fehlende Uhrzeit, statt eine zu erfinden", () => {
    expect(records[3]!.kickoffTimeKnown).toBe(false);
  });

  it("bildet stabile externe IDs und trägt die Herkunft", () => {
    expect(records[0]!.externalId).toBe("BL1:2026-08-28:fc-bayern-munchen:vfb-stuttgart");
    expect(records[0]!.provenance).toEqual({
      source: "openfootball",
      fetchedAt,
      sourceUrl: "https://example.invalid/de.1.json",
    });
  });

  it("baut die URL aus Saison und Dateischlüssel", () => {
    expect(openfootballUrl("de.1", 2026)).toBe(
      "https://raw.githubusercontent.com/openfootball/football.json/master/2026-27/de.1.json",
    );
  });

  it("führt nur Wettbewerbe mit openfootball-Datei", () => {
    const p = new OpenfootballProvider();
    expect(p.supports("BL1")).toBe(true);
    expect(p.supports("CL")).toBe(false);
  });

  it("holt über fetch, validiert und cacht", async () => {
    let calls = 0;
    const fetchImpl = (async () => {
      calls++;
      return new Response(JSON.stringify(raw), { status: 200 });
    }) as typeof fetch;
    const p = new OpenfootballProvider({ fetchImpl, cache: new MemoryCache() });
    const first = await p.getMatches("BL1");
    const second = await p.getMatches("BL1");
    expect(first).toHaveLength(4);
    expect(second).toHaveLength(4);
    expect(calls).toBe(1);
  });
});

describe("football-data.org", () => {
  // Aufbau nach der offiziellen Dokumentation (v4), gekürzt.
  const sample: FootballDataMatches = footballDataMatchesSchema.parse({
    matches: [
      {
        id: 101,
        utcDate: "2026-10-17T13:30:00Z",
        status: "TIMED",
        matchday: 7,
        stage: "REGULAR_SEASON",
        homeTeam: { id: 5, name: "FC Bayern München", shortName: "Bayern", crest: null },
        awayTeam: { id: 4, name: "Borussia Dortmund", shortName: "Dortmund", crest: null },
        score: { fullTime: { home: null, away: null } },
      },
      {
        id: 102,
        utcDate: "2026-09-20T15:30:00Z",
        status: "FINISHED",
        matchday: 4,
        homeTeam: { id: 3, name: "Bayer 04 Leverkusen", shortName: "Leverkusen" },
        awayTeam: { id: 11, name: "VfL Wolfsburg", shortName: "Wolfsburg" },
        score: { fullTime: { home: 2, away: 1 } },
      },
      {
        id: 103,
        utcDate: "2027-05-29T18:00:00Z",
        status: "SCHEDULED",
        matchday: null,
        homeTeam: { id: null, name: null },
        awayTeam: { id: null, name: null },
        score: { fullTime: { home: null, away: null } },
      },
    ],
  });
  const records = parseFootballData(sample, "BL1", "2026/27", fetchedAt, "https://x.invalid");

  it("übersetzt Status und Ergebnisse", () => {
    expect(records[0]).toMatchObject({ status: "scheduled", homeScore: null, externalId: "101" });
    expect(records[1]).toMatchObject({ status: "finished", homeScore: 2, awayScore: 1 });
  });

  it("überspringt Spiele mit noch unbekannten Teams", () => {
    expect(records).toHaveLength(2);
  });
});

describe("The Odds API", () => {
  // Aufbau nach der offiziellen Dokumentation (v4), gekürzt.
  const sample = oddsApiResponseSchema.parse([
    {
      id: "ev1",
      sport_key: "soccer_germany_bundesliga",
      commence_time: "2026-10-17T13:30:00Z",
      home_team: "Bayern Munich",
      away_team: "Borussia Dortmund",
      bookmakers: [
        {
          key: "tipico_de",
          title: "Tipico (DE)",
          last_update: "2026-10-13T11:55:00Z",
          markets: [
            {
              key: "h2h",
              outcomes: [
                { name: "Bayern Munich", price: 1.6 },
                { name: "Borussia Dortmund", price: 4.8 },
                { name: "Draw", price: 4.4 },
              ],
            },
            {
              key: "totals",
              outcomes: [
                { name: "Over", price: 1.55, point: 2.5 },
                { name: "Under", price: 2.35, point: 2.5 },
              ],
            },
          ],
        },
        {
          key: "unbekannter_anbieter",
          markets: [{ key: "h2h", outcomes: [{ name: "Draw", price: 9 }] }],
        },
      ],
    },
  ]);
  const records = parseOddsApi(sample, fetchedAt, "https://api.the-odds-api.com/v4/sports/x/odds");

  it("ordnet Ausgänge home/draw/away und Über/Unter mit Linie zu", () => {
    const sel = records.map((r) => `${r.market}:${r.selection}:${r.line ?? ""}:${r.price}`);
    expect(sel).toEqual([
      "h2h:home::1.6",
      "h2h:away::4.8",
      "h2h:draw::4.4",
      "totals:over:2.5:1.55",
      "totals:under:2.5:2.35",
    ]);
  });

  it("ignoriert nicht konfigurierte Buchmacher", () => {
    expect(records.every((r) => r.bookmakerKey === "tipico")).toBe(true);
  });

  it("speichert keine Zugangsdaten in der Quell-URL", () => {
    expect(records[0]!.provenance.sourceUrl).not.toMatch(/apiKey/);
  });

  it("lehnt Quoten ≤ 1 ab", () => {
    expect(() =>
      oddsApiResponseSchema.parse([
        { ...sample[0], bookmakers: [{ key: "tipico_de", markets: [{ key: "h2h", outcomes: [{ name: "Draw", price: 1 }] }] }] },
      ]),
    ).toThrow();
  });
});
