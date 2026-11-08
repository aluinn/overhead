# Orbital mechanics

The maths behind what you see. Everything here lives in `src/lib/orbital` as pure functions with unit tests
(`tests/unit`), so it can be read and checked without a browser.

## From GP data to a position

CelesTrak publishes **GP** (general perturbations) element sets: *mean* orbital elements fitted to tracking data.
They're only meaningful when fed to the matching propagator, **SGP4**, which reapplies the periodic perturbations
(Earth's J2/J4 oblateness, atmospheric drag via the B\* term, and for deep-space orbits lunar-solar effects) to give an
instantaneous position and velocity.

`satrecFromCompact` rebuilds an OMM record and calls [satellite.js](https://github.com/shashwatak/satellite-js)'s
`json2satrec` (SGP4 initialisation). `sgp4(satrec, tsince)` then returns position/velocity where
`tsince = (JD − satrec.jdsatepoch) × 1440` minutes.

**Validation:** the unit tests propagate the classic Spacetrack Report #3 / Vallado case `88888` to `t = epoch` and
check the position against the published values (`x = 2328.97048951 km`, `y = −5995.22076416`, `z = 1719.97067261`).

### Accuracy, honestly

- GP/SGP4 positions are good to about **1 km at epoch**, degrading by roughly **1–3 km per day** for LEO.
  Dragged-down or recently manoeuvred objects can be worse. The scrubber allows ±24 h, which stays inside that.
- OVERHEAD ignores polar motion (< 20 m) and uses UTC for UT1 (< 1 s of sidereal time, ≈ tens of metres at the
  surface). Invisible at globe scale, and irrelevant for "is it above 10°".
- This is a visualisation, not a conjunction-assessment tool. Don't manoeuvre a satellite based on it.

## Time and frames

- **Julian date**: `JD = unixMs / 86 400 000 + 2 440 587.5`.
- SGP4 outputs **TEME** (True Equator, Mean Equinox), an inertial-ish frame.
- **GMST** (`gstime(JD)`) is the Greenwich sidereal angle θ. Rotating TEME → **ECEF** (Earth-fixed) about Z:

  ```
  X_ecef =  cosθ · x + sinθ · y
  Y_ecef = −sinθ · x + cosθ · y
  Z_ecef =  z
  ```

  `ecefAt` does this (and is tested against satellite.js's own `eciToEcf`). GMST is computed **once per batch**, not
  once per object.
- **Scene space** (three.js, Y-up, unit = one Earth radius of 6,371 km): `scene = (X, Z, −Y) / 6371`.
  This matches how `SphereGeometry` wraps an equirectangular texture, so lat/lon lands correctly on the Earth mesh.
  A test asserts the mapping.

Rendering in the Earth-fixed frame means the planet never rotates; the *sun* does, via `sunDirectionEcef`
(Astronomical Almanac low-precision formula, ~0.01° accurate, rotated by GMST) which drives the terminator and city
lights.

## Looking up from the ground

Given an observer at geodetic (φ, λ, h) on the **WGS-84** ellipsoid (a = 6378.137 km, f = 1/298.257223563):

```
N  = a / √(1 − e² sin²φ)
X  = (N + h) cosφ cosλ
Y  = (N + h) cosφ sinλ
Z  = (N(1 − e²) + h) sinφ
```

The local **East / North / Up** unit vectors in ECEF are:

```
E = (−sinλ,          cosλ,         0   )
N = (−sinφ cosλ,    −sinφ sinλ,    cosφ)
U = ( cosφ cosλ,     cosφ sinλ,    sinφ)
```

For a satellite at ECEF **s**, the range vector is **ρ** = **s** − **observer**, and

```
elevation = asin( (ρ·U) / |ρ| )
azimuth   = atan2( ρ·E, ρ·N )      (0° = North, clockwise)
range     = |ρ|
```

`computeVisible` is called once per second over the renderer's interpolated positions (so the list always agrees
with what's drawn) and keeps objects with elevation ≥ **10°**. It tests `(ρ·U)/|ρ| ≥ sin(10°)` first and only
computes azimuth for survivors. The radar plot maps `r ∝ (90° − elevation)` with zenith at the centre, **North up
and East on the left**: the view you get lying on your back.

### The horizon ring

The ring drawn on the globe is the ground footprint of a satellite at altitude *H* seen above elevation ε:

```
λ = acos( R·cos ε / (R + H) ) − ε
```

At *H* = 550 km (a Starlink shell), ε = 10°, that's ≈ 15° of arc (~1,670 km).

## Starlink trains

A **train** is a freshly launched batch that hasn't spread out yet: dozens of satellites in nearly the same orbit,
tens of km apart. `detectTrains` finds them geometrically:

1. Hash candidate positions into cells of edge `linkKm` (200 km).
2. For each satellite, compare with satellites in the 27 neighbouring cells; **link** a pair if they are within
   200 km **and** share a plane: inclination within 0.35°, RAAN within 1.5°, mean motion within 0.06 rev/day.
3. Union-find the links into clusters; keep clusters of **≥ 5**.
4. Order members along the cluster axis and report its extent.

The plane check matters: satellites in adjacent planes can be physically close at the poles without being a train.
Settled constellations (~4,000 km between neighbours in-plane) never link, which a unit test asserts. Cost is
near-linear: ~23 ms for 11,000 satellites ([PERFORMANCE.md](PERFORMANCE.md)).

## Close approaches

SOCRATES reports the time of closest approach (TCA), the miss distance and the relative speed. For the local fallback,
`scanConjunctions` finds them itself:

1. Sample all pair separations every 30 s over the window.
2. A pair is a **candidate** at step *k* if `d(k−1) ≤ d(k−2)` and `d(k−1) < d(k)` (a sampled local minimum) and
   `d(k−1) < √(threshold² + (v_rel·Δt/2)²)`. That bound is the farthest a genuine sub-threshold pass can look when
   sampled, at an assumed worst-case relative speed of 16 km/s.
3. Refine each candidate on `[t(k−2), t(k)]` with a **golden-section search** on the separation (it is unimodal in
   a bracket this short) down to 1 ms, then evaluate range and relative speed (|Δ**v**|) there.
4. Drop pairs slower than 0.5 km/s (docked/co-orbiting) and de-duplicate.

Separations are computed in TEME, which is fine: distances don't depend on the frame as long as both objects use the
same one. The tests compare refined results with a brute-force 1 ms scan of the real SGP4 separation. (Note: an
idealised two-circle model doesn't match SGP4's closest approach, since SGP4's short-period J2 terms displace each
orbit by a few km. The brute-force comparison is the honest check.)

When you click a conjunction, the clock seeks to TCA − 25 s, the camera frames the midpoint, and both objects' paths
(TCA ± 12 min) and a live separation line are drawn. The distance on the line is computed from the rendered
positions, so you can watch it fall to the SOCRATES value.

## References

- Hoots & Roehrich, *Spacetrack Report No. 3* (1980); Vallado et al., *Revisiting Spacetrack Report #3* (2006).
- T.S. Kelso, *CelesTrak*: [GP data formats](https://celestrak.org/NORAD/documentation/gp-data-formats.php),
  [SOCRATES Plus](https://celestrak.org/SOCRATES/).
- CCSDS 502.0-B-3, *Orbit Data Messages* (OMM).
- *Astronomical Almanac*, low-precision solar coordinates.
