import { describe, expect, it } from "vitest";
import { isAuthorized } from "@/lib/basic-auth";

const header = (user: string, pw: string) => `Basic ${btoa(`${user}:${pw}`)}`;

describe("isAuthorized", () => {
  it("lässt richtige Zugangsdaten durch", () => {
    expect(isAuthorized(header("fussball", "geheim:mit:doppelpunkt"), "fussball", "geheim:mit:doppelpunkt")).toBe(true);
  });
  it("weist falsches Passwort, falschen Nutzer und fehlenden Header ab", () => {
    expect(isAuthorized(header("fussball", "falsch"), "fussball", "geheim")).toBe(false);
    expect(isAuthorized(header("andere", "geheim"), "fussball", "geheim")).toBe(false);
    expect(isAuthorized(null, "fussball", "geheim")).toBe(false);
  });
  it("übersteht kaputte Header", () => {
    expect(isAuthorized("Basic %%%", "a", "b")).toBe(false);
    expect(isAuthorized(`Basic ${btoa("ohne-doppelpunkt")}`, "a", "b")).toBe(false);
    expect(isAuthorized("Bearer xyz", "a", "b")).toBe(false);
  });
});
