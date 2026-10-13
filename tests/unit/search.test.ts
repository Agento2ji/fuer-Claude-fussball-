import { describe, expect, it } from "vitest";

// normalizeQuery ist reine Logik; das Modul selbst lädt die DB nur bei Aufruf von search().
import { vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("@/db", () => ({ getDb: () => { throw new Error("nicht im Test"); } }));
const { normalizeQuery } = await import("@/lib/queries/search");

describe("normalizeQuery", () => {
  it("vereinheitlicht Umlaute, Akzente und Großschreibung", () => {
    expect(normalizeQuery("München")).toBe("munchen");
    expect(normalizeQuery("  Atlético ")).toBe("atletico");
    expect(normalizeQuery("Ñandú")).toBe("nandu");
  });
  it("macht ß zu s", () => {
    expect(normalizeQuery("Fußball")).toBe("fusball");
  });
});
