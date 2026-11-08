---
title: "Predict the next passes of a selected object over the observer"
labels: [enhancement]
---

## Context
"When can I see the ISS?" is the most common question. We already have look angles and the worker.

## Task
- Add a `passes` worker message: for one object and an observer, step forward (e.g. 20 s) over 24 h, find rise/culmination/set where elevation crosses the mask, and refine with bisection to ~1 s.
- Show a list in the object card: rise time + azimuth, max elevation, set time + azimuth, duration.
- Clicking a pass seeks the clock to its rise and points the camera at the observer.

## Acceptance
- Typed in `workers/messages.ts`; pure maths in `lib/orbital/passes.ts` with unit tests (use the 88888 fixture or a synthetic circular orbit with a known period).
- Works with the clock scrubbed away from "now".
