import { describe, expect, it } from "vitest";
import { parseServerEnv } from "@/lib/env";

describe("parseServerEnv", () => {
  it("akzeptiert eine Postgres-URL ohne Anbieter-Keys", () => {
    const env = parseServerEnv({
      DATABASE_URL: "postgres://u:p@localhost:5432/db",
    });
    expect(env.THE_ODDS_API_KEY).toBeUndefined();
  });

  it("behandelt leere Strings als nicht gesetzt", () => {
    const env = parseServerEnv({
      DATABASE_URL: "postgresql://u:p@localhost:5432/db",
      THE_ODDS_API_KEY: "",
    });
    expect(env.THE_ODDS_API_KEY).toBeUndefined();
  });

  it("lehnt eine fehlende Datenbank-URL mit deutscher Meldung ab", () => {
    expect(() => parseServerEnv({})).toThrow(/Ungültige Umgebungsvariablen/);
  });

  it("lehnt eine Nicht-Postgres-URL ab", () => {
    expect(() =>
      parseServerEnv({ DATABASE_URL: "mysql://u:p@localhost/db" }),
    ).toThrow(/DATABASE_URL/);
  });
});
