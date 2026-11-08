---
title: "Show the Sun (and twilight state) on the sky plot"
labels: [good first issue, enhancement]
---

## Context
Satellites are only visible to the naked eye when the observer is in darkness and the satellite is sunlit. A first step is showing where the Sun is.

## Task
- Reuse `sunDirectionEcef` to compute the Sun's azimuth/elevation for the observer (add a `sunLookAngle` helper next to `lookAngle` in `lookAngles.ts`, with a unit test, e.g. noon at the equator on an equinox ≈ 90°).
- Draw a small sun glyph on `RadarPlot` when above the horizon.
- Show "DAY / CIVIL / NAUTICAL / ASTRONOMICAL TWILIGHT / NIGHT" in the sky tab header (sun elevation > 0, > −6°, > −12°, > −18°, else).

## Acceptance
- Helper has tests; radar still looks right at phone width.
