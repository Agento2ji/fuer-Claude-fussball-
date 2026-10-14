import { describe, expect, it } from "vitest";
import { matches } from "@/db/schema";
import { chunks, dedupeBy, excludedSet } from "@/ingestion/store/common";

describe("Gebündeltes Schreiben", () => {
  it("teilt in Blöcke fester Größe", () => {
    expect(chunks([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    expect(chunks([], 2)).toEqual([]);
  });

  it("behält je Schlüssel den letzten Eintrag", () => {
    const rows = [
      { k: "a", v: 1 },
      { k: "b", v: 2 },
      { k: "a", v: 3 },
    ];
    expect(dedupeBy(rows, (r) => r.k)).toEqual([
      { k: "a", v: 3 },
      { k: "b", v: 2 },
    ]);
  });

  it("übersetzt Feldnamen in Spaltennamen für excluded", () => {
    const set = excludedSet(matches, ["homeScore", "kickoffAt"]);
    expect(Object.keys(set)).toEqual(["homeScore", "kickoffAt"]);
    expect(() => excludedSet(matches, ["gibtEsNicht"])).toThrow("Spalte gibtEsNicht fehlt");
  });
});
