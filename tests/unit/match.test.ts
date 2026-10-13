import { describe, expect, it } from "vitest";
import { countdownParts, headToHead } from "@/lib/match";

describe("countdownParts", () => {
  const now = new Date("2026-10-13T12:00:00Z");
  it("zerlegt die Zeit bis Anstoß", () => {
    expect(countdownParts(new Date("2026-10-15T15:30:45Z"), now)).toEqual({ days: 2, hours: 3, minutes: 30, seconds: 45, started: false });
  });
  it("meldet ein begonnenes Spiel", () => {
    expect(countdownParts(new Date("2026-10-13T11:59:59Z"), now).started).toBe(true);
  });
});

describe("headToHead", () => {
  it("zählt aus Sicht des ersten Teams, egal wer Heim war", () => {
    const h = headToHead(
      [
        { homeTeamId: 1, awayTeamId: 2, homeScore: 2, awayScore: 0 },
        { homeTeamId: 2, awayTeamId: 1, homeScore: 1, awayScore: 1 },
        { homeTeamId: 2, awayTeamId: 1, homeScore: 3, awayScore: 1 },
      ],
      1,
    );
    expect(h).toEqual({ played: 3, wins: 1, draws: 1, losses: 1, goalsFor: 4, goalsAgainst: 4 });
  });
});
