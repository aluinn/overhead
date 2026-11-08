import { describe, expect, it } from "vitest";
import { compactFromOmm, parseGpJson, splitCsvLine } from "@/lib/data/parse";
import fixture from "../fixtures/gp-iss.json";

describe("compactFromOmm", () => {
  it("converts a real CelesTrak ISS record into the compact tuple", () => {
    const rec = compactFromOmm(fixture.valid[0]);
    expect(rec).not.toBeNull();
    const [id, name, epochMs, mm, ecc, incl] = rec!;
    expect(id).toBe(25544);
    expect(name).toBe("ISS (ZARYA)");
    expect(mm).toBeCloseTo(15.49256954, 8);
    expect(ecc).toBeCloseTo(0.0007219, 7);
    expect(incl).toBeCloseTo(51.632, 3);
    // CelesTrak epochs are UTC without a zone suffix.
    expect(epochMs).toBe(Date.UTC(2026, 10, 8, 4, 12, 35, 430));
  });

  it.each(fixture.invalid.map((x, i) => [i, x] as const))("rejects malformed record #%i", (_i, bad) => {
    expect(compactFromOmm(bad)).toBeNull();
  });
});

describe("parseGpJson", () => {
  it("drops invalid entries but keeps valid ones", () => {
    const out = parseGpJson([...fixture.valid, ...fixture.invalid]);
    expect(out).toHaveLength(1);
    expect(out[0][0]).toBe(25544);
  });

  it("returns an empty list for non-array input", () => {
    expect(parseGpJson({ error: "nope" })).toEqual([]);
    expect(parseGpJson(null)).toEqual([]);
  });
});

describe("splitCsvLine", () => {
  it("splits plain fields", () => {
    expect(splitCsvLine("a,b,c")).toEqual(["a", "b", "c"]);
  });
  it("keeps commas inside quotes and unescapes doubled quotes", () => {
    expect(splitCsvLine('1,"NAME, WITH COMMA",3,"say ""hi"""')).toEqual(["1", "NAME, WITH COMMA", "3", 'say "hi"']);
  });
  it("preserves empty trailing fields", () => {
    expect(splitCsvLine("a,,")).toEqual(["a", "", ""]);
  });
});
