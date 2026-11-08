# Roadmap

Rough priorities, not promises. Anything marked with an issue draft in [`docs/issues`](docs/issues) is ready to pick up.

## Now (v0.1: shipped)

- [x] Hero globe: night lights, sun-driven terminator, atmosphere, 19k+ objects as GPU points
- [x] CelesTrak GP + SOCRATES via cached API routes, with layered fallbacks and a bundled sample
- [x] SGP4 in a Web Worker with GPU interpolation and 1×/60×/600× time controls
- [x] "Over my head": geolocation + city fallback, live count, radar, list
- [x] Starlink train detection
- [x] Near-miss feed with time-travel to TCA, and an in-worker fallback
- [x] Share image (copy / download / X intent), dynamic OG card, `?embed=1`

## Next

- [ ] **Pass predictions**: "ISS rises NW at 21:14, peaks at 63°, sets SE at 21:19" for the observer
- [ ] **Naked-eye visibility**: dim objects in Earth's shadow, flag sunlit-while-you're-in-darkness passes
- [ ] **Shareable state in the URL**: observer, time and selected object, so a link reproduces your view
- [ ] **Search**: find an object by name or NORAD ID and fly to it
- [ ] Keyboard shortcuts and a proper accessibility pass (focus order in the panel, live-region counts)

## Later

- [ ] 4K Earth textures with progressive loading, plus an optional cloud layer
- [ ] PWA: cache the last GP set so the app opens offline with *recent* (not sample) data
- [ ] Ground tracks and footprints for selected objects
- [ ] Re-entry watch: objects with decaying orbits and predicted decay windows
- [ ] SupGP (operator ephemerides) for Starlink/OneWeb where it is more accurate than GP
- [ ] Moon and Sun markers on the radar

## Ideas, not committed

- Per-launch grouping ("Starlink Group 12-4") with a launch timeline
- A "what was overhead at this time" permalink for photographers
- WebGPU renderer for 100k+ object catalogs

Have a proposal? Open a feature request, or pick up one of the drafts in `docs/issues`.
