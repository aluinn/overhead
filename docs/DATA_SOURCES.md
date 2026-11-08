# Data sources

All orbital data comes from [CelesTrak](https://celestrak.org), maintained by Dr. T.S. Kelso. OVERHEAD is a
guest on that service and is built to be a quiet one.

## GP element sets

`GET https://celestrak.org/NORAD/elements/gp.php?GROUP=<group>&FORMAT=json`

Returns [OMM](https://public.ccsds.org/Pubs/502x0b3e1.pdf) JSON: mean elements (epoch, mean motion, eccentricity,
inclination, RAAN, argument of perigee, mean anomaly, B\*, …) that SGP4 turns into a position. Groups used
(counts observed on 2026-11-08, which drift daily):

| Group                | Kind     | Objects | Notes                                  |
| -------------------- | -------- | ------: | -------------------------------------- |
| `active`             | Satellite | ~16,900 | Includes Starlink and stations         |
| `starlink`           | Starlink | ~11,200 |                                        |
| `stations`           | Station  |      19 | ISS, Tiangong modules, …               |
| `cosmos-2251-debris` | Debris   |     583 | 2009 Iridium-33 / Cosmos-2251 collision |
| `iridium-33-debris`  | Debris   |     109 |                                        |
| `fengyun-1c-debris`  | Debris   |   1,977 | 2007 anti-satellite test               |
| `cosmos-1408-debris` | Debris   |       2 | 2021 test; most fragments have decayed |

Groups overlap, so the client merges by NORAD ID and keeps the highest-priority kind
(station > Starlink > debris > other). Any object named `STARLINK-*` is classified as Starlink even when it only
appears in `active`. After merging that is roughly **19,000 distinct objects**.

### Wire format

Route handlers return a compact positional tuple instead of the OMM object (about 4× smaller):

```
[noradId, name, epochMs, meanMotion, eccentricity, inclination, raan, argOfPerigee, meanAnomaly, bstar, ndot, nddot]
```

Records that fail validation (missing field, non-numeric value, `meanMotion ≤ 0`, `e ≥ 1`) are dropped
individually; one bad row never poisons a group. See `src/lib/data/parse.ts`.

## Rate limits and how we respect them

CelesTrak updates element sets roughly every 2 hours and **blocks clients that re-download the same data more often**.
We hit this ourselves during development (HTTP 403), which is why the caching is layered:

1. **CDN**: responses carry `Cache-Control: public, s-maxage=10800, stale-while-revalidate=43200`. On Vercel the
   edge cache absorbs nearly all traffic.
2. **Instance memory** (3 h TTL), with in-flight de-duplication so a burst of cold requests makes one upstream call.
3. **Disk** (`$TMPDIR/overhead-cache/gp-<group>.json`), which survives restarts and is shared by warm serverless
   instances. This is what keeps `npm run dev` restarts from re-downloading.
4. **Failure back-off**: after any upstream error, that group is not requested again for 5 minutes.
5. **Degrade, don't fail**: stale cache if we have one, otherwise the bundled sample. Fallback responses are cached
   only 5 minutes at the CDN so recovery is quick.

The browser only ever calls our own `/api/*`. The `[group]` parameter is checked against a fixed allow-list, so there
are no user-controlled upstream URLs.

If you fork this, keep a descriptive `User-Agent` (the handlers send one) and keep the cache.

## SOCRATES Plus (close approaches)

`GET https://celestrak.org/SOCRATES/sort-minRange.csv` (the full CSV, ~23 MB, one row per predicted conjunction in the
next 7 days, sorted by minimum range).

CSV columns used: `NORAD_CAT_ID_1/2`, `OBJECT_NAME_1/2`, `TCA` (UTC), `TCA_RANGE` (km), `TCA_RELATIVE_SPEED` (km/s),
`MAX_PROB`. Names carry an operational-status suffix (`POISK [+]`) which we strip.

Raw SOCRATES output needs filtering to be interesting. `/api/conjunctions` keeps events that:

- **have a relative speed ≥ 0.5 km/s.** The top of the file is dominated by docked/co-orbiting pairs (ISS + visiting
  vehicles at 0.006 km and 0.000 km/s). That's not a near miss.
- occur in the **next 72 hours**,
- and then returns the **120 closest**.

Because the CSV is far over Next's 2 MB fetch-cache limit, the route caches the *parsed* result itself (3 h) and
streams the file line by line (`src/lib/data/socrates.ts`).

SOCRATES screens the whole catalog; OVERHEAD only draws the objects in the groups above. The feed therefore has a
**TRACKED ONLY** toggle (on by default) that hides events involving objects we can't fly to.

### Fallback: computing approaches locally

If SOCRATES is unreachable, the client computes close approaches in the worker over a deterministic subset
(~320 objects: all stations plus a stride-sampled spread of LEO satellites and debris) for the next 6 hours:
pair separations are sampled every 30 s, sampled minima are refined with a golden-section search to 1 ms, and docked
pairs are filtered out. It takes roughly a second, is labelled **COMPUTED IN YOUR BROWSER**, and is validated against
a brute-force minimum in the unit tests. It finds fewer events than SOCRATES by construction. See
[ORBITAL_MECHANICS.md](ORBITAL_MECHANICS.md#close-approaches).

## Bundled sample dataset

`public/data/sample-gp.json` (~170 KB) is what the app falls back to so it never shows a blank screen: the 19
stations, 420 Starlink satellites, 600 active satellites, ~280 debris objects, and 40 SOCRATES events (shifted at
serve time so they lie in the future). It's regenerated with:

```bash
npm run fetch-sample      # downloads several large files: run rarely
```

The generator also adds every object that appears in a sample conjunction, so the sample feed is always flyable.

## Fallback matrix

| Situation                               | GP data            | Near-miss feed           |
| --------------------------------------- | ------------------ | ------------------------ |
| Everything works                        | CelesTrak          | SOCRATES                 |
| CelesTrak rate-limits one group         | Mixed: live + sample for that group | SOCRATES |
| CelesTrak down, cache warm              | Stale cache        | Stale cache              |
| CelesTrak down, cold start              | Bundled sample     | Computed in worker       |
| Our `/api` unreachable                  | `/data/sample-gp.json` | Computed in worker   |

## Attribution

Orbital data © CelesTrak. Please credit them if you build on this, and consider
[supporting their work](https://celestrak.org/support/). Earth textures are from the
[three.js examples](https://github.com/mrdoob/three.js/tree/dev/examples/textures/planets) (MIT).
