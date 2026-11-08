# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- `?embed=1` mode that collapses the interface to the globe, counter and hover/click cards (see `examples/embed.html`).

## [0.1.0] - 2026-11-08

### Added
- **Hero globe**: dark Earth with city lights on the night side, a terminator driven by the real sun position, a
  fresnel atmosphere glow, a deterministic starfield and an intro camera fly-in.
- **19,000+ objects** drawn as a single GPU point cloud, coloured by type: Starlink (cyan), debris (orange), stations
  (gold, with ISS and Tiangong labels) and other satellites (white).
- **Worker propagation**: SGP4 for the whole catalog in a Web Worker, in 4,096-object batches, with the position
  buffer transferred zero-copy each tick and interpolated on the GPU between ticks.
- **Cached data API**: `/api/gp/[group]` and `/api/conjunctions` fetch CelesTrak server-side with memory + disk
  caching, CDN headers, failure back-off and fallbacks to stale data and a bundled sample dataset.
- **Over my head**: browser geolocation with a city / lat-lon fallback picker, a live count of objects above 10°
  elevation, a polar sky plot and a list sorted by elevation.
- **Starlink trains**: spatial-hash detection of tight same-plane clusters, labelled on the globe and in the list.
- **Object details**: hover/click any object for name, NORAD ID, altitude, speed, lat/lon, period and a toggleable orbit trail.
- **Near-miss feed**: upcoming close approaches from CelesTrak SOCRATES (docked pairs filtered out). Selecting one
  time-travels to just before the closest approach, frames both objects, draws both paths and a live separation line.
  Falls back to computing approaches in the worker when SOCRATES is unreachable.
- **Time controls**: live by default, 1× / 60× / 600× speed, a ±24 h scrubber and a NOW button.
- **Share**: a 16:9 PNG with the headline stat and a URL watermark; copy to clipboard, download, native share, or
  a "post to X" intent link.
- **Dynamic Open Graph card** with live active/Starlink counts when data is live.
- Mobile layout with a bottom sheet for the panel; `prefers-reduced-motion` support.
- Unit tests (Vitest) for look angles, train detection, GP/CSV parsing, SOCRATES parsing, SGP4 against the Spacetrack
  Report #3 reference vector, conjunction refinement and the solar position; a Playwright smoke test.
- CI (lint, typecheck, test, build, e2e), CodeQL, Dependabot, and contribution/community files.

### Fixed
- Production builds hung under Turbopack because satellite.js 7's WASM entry points were bundled; they are now
  aliased to a stub (we only use the pure-JS SGP4).

[Unreleased]: https://github.com/aluinn/overhead/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/aluinn/overhead/releases/tag/v0.1.0
