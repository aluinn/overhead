---
title: "Add an elevation-mask slider to the sky tab"
labels: [good first issue, enhancement]
---

## Context
The "above you" count and radar use a fixed 10° elevation mask (`MIN_ELEVATION_DEG` in `src/store/runtime.tsx`). Observers with a clear horizon want 0–5°; urban observers want 20–30°.

## Task
- Add a slider (5°–45°, step 5) to `SkyTab`, stored in the app store and persisted in `localStorage`.
- `computeVisible`, the radar rings (`RadarPlot`) and the horizon ring on the globe (`footprintAngleDeg`) must all use it.
- Update the copy that says "ABOVE 10° ELEVATION".

## Acceptance
- Changing the slider updates the count within one second.
- A unit test covers `computeVisible` at a non-default mask.

## Pointers
`src/lib/orbital/lookAngles.ts`, `src/hooks/useObserver.ts`, `src/components/sky/`.
