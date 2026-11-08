---
title: "Encode observer, time and selection in the URL"
labels: [enhancement]
---

## Task
Make a link reproduce a view: `/?lat=51.5&lon=-0.12&t=2026-11-09T20:22:42Z&obj=25544`.

- Read the params once on load (validate and clamp; ignore garbage) and write them with `history.replaceState` as state changes, throttled.
- Pairs with the share dialog: include the link text in the "post to X" intent.
- Don't put the location in the URL unless the user opts in (privacy: add a checkbox in the share dialog).

## Acceptance
- Unit tests for parse/serialise round-trips and invalid input.
- Loading a link with `t` in the past starts paused at 1× from that time (use `clock.seek`).
