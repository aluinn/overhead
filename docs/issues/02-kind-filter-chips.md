---
title: "Filter the overhead list and radar by object type"
labels: [good first issue, enhancement]
---

## Context
Debris often dominates the "above you" list. People want to see only Starlink, only stations, or hide debris.

## Task
Add toggle chips (Starlink / Satellites / Debris / Stations) above the radar. They filter both `OverheadList` and `RadarPlot`, and the count in the header (not the headline counter) should say "N of M".

## Acceptance
- Chips are keyboard accessible (`aria-pressed`).
- Filter state survives the 1 Hz refresh.
- Colours match `KIND_COLORS`.

## Pointers
`src/components/sky/SkyTab.tsx`, `src/components/globe/SatellitePoints.ts`.
