---
title: "Grow the bundled city list and test the search"
labels: [good first issue, enhancement]
---

## Context
The manual location fallback uses a bundled list of ~70 cities (`src/lib/geo/cityLookup.ts`). It has no tests, and many regions are missing.

## Task
- Add ~100 more cities, prioritising regions with none (Central Asia, West Africa, the Pacific, small island states).
- Add `tests/unit/cityLookup.test.ts`: prefix-before-substring ordering, accent folding ("Bogota" → Bogotá), `parseLatLon` formats (`51.5, -0.12`, `51.5N 0.12W`, out-of-range → null), and `nearestCity`.

## Acceptance
- No duplicates (name + country).
- `npm test` passes.
