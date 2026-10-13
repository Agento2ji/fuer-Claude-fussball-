import { describe, expect, it } from "vitest";
import { toPostgresJsUrl } from "@/db/client";

describe("toPostgresJsUrl", () => {
  it("entfernt channel_binding, behält sslmode", () => {
    const out = toPostgresJsUrl("postgresql://u:p@ep-x-pooler.eu-central-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require");
    expect(out).toBe("postgresql://u:p@ep-x-pooler.eu-central-1.aws.neon.tech/neondb?sslmode=require");
  });

  it("lässt lokale Adressen unverändert", () => {
    const url = "postgres://fussball:fussball@localhost:5432/fussball_hub";
    expect(toPostgresJsUrl(url)).toBe(url);
  });
});
