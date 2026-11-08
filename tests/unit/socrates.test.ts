import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { cleanName, parseSocratesCsv, parseTca } from "@/lib/data/socrates";

const csv = readFileSync(path.join(import.meta.dirname, "../fixtures/socrates-sample.csv"), "utf8");
const NOW = Date.UTC(2026, 10, 8, 12, 0, 0);

describe("cleanName / parseTca", () => {
  it("strips the trailing status bracket", () => {
    expect(cleanName("POISK [+]")).toBe("POISK");
    expect(cleanName("COSMOS 1408 DEB [-]")).toBe("COSMOS 1408 DEB");
    expect(cleanName("NO STATUS")).toBe("NO STATUS");
  });
  it("parses SOCRATES timestamps as UTC", () => {
    expect(parseTca("2026-11-09 04:20:35.947")).toBe(Date.UTC(2026, 10, 9, 4, 20, 35, 947));
    expect(Number.isNaN(parseTca("garbage"))).toBe(true);
  });
});

describe("parseSocratesCsv", () => {
  const events = parseSocratesCsv(csv, { notBeforeMs: NOW });

  it("filters docked pairs, slow co-orbiters, past events and unparseable rows", () => {
    // Left: STARLINK pair (0.022 km), ISS/COSMOS DEB (1.25 km)
    expect(events.map((e) => e.noradId1)).toEqual([67966, 25544]);
  });

  it("sorts closest approach first", () => {
    expect(events[0].rangeKm).toBeLessThan(events[1].rangeKm);
  });

  it("extracts every displayed field", () => {
    const e = events[0];
    expect(e).toMatchObject({
      noradId1: 67966,
      name1: "STARLINK-36820",
      noradId2: 100181,
      name2: "STARLINK-38112, TEST", // quoted comma survives
      rangeKm: 0.022,
      relSpeedKmS: 15.028,
      maxProbability: 0.3293,
    });
    expect(e.tcaMs).toBe(Date.UTC(2026, 10, 9, 4, 20, 35, 947));
  });

  it("honours the limit", () => {
    expect(parseSocratesCsv(csv, { notBeforeMs: NOW, limit: 1 })).toHaveLength(1);
  });

  it("throws a clear error when the header is not SOCRATES", () => {
    expect(() => parseSocratesCsv("a,b,c\n1,2,3")).toThrow(/missing column/);
  });
});
