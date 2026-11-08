---
title: "Mark satellites that are sunlit while the observer is in darkness"
labels: [enhancement]
---

## Context
Most objects overhead at noon are invisible. A "visible to the eye" filter would make the sky tab far more useful at dusk and dawn.

## Task
- For each visible object compute whether it is in Earth's shadow (cylindrical shadow is fine; satellite.js exports `shadowFraction` if you want more) and whether the observer's Sun elevation is below −6°.
- Add a flag bit to `aFlag` in the point shader (`bit 4`) and brighten "visible to the eye" objects.
- Add a **VISIBLE NOW** toggle to the sky list.

## Acceptance
- Unit test: a satellite directly behind the Earth relative to the Sun is shadowed.
- Document the model's limits (no magnitude estimate yet) in `docs/ORBITAL_MECHANICS.md`.
