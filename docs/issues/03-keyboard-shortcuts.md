---
title: "Keyboard shortcuts for time and selection"
labels: [good first issue, enhancement]
---

## Task
Add global shortcuts (ignore them while an input is focused):

| Key | Action |
| --- | --- |
| `N` | Go live (`clock.goLive()`) |
| `1` / `2` / `3` | 1× / 60× / 600× |
| `←` / `→` | Seek ∓15 min |
| `T` | Toggle orbit trail |
| `Esc` | Deselect / close dialogs (partly exists) |

Show them in a small "?" popover.

## Acceptance
- Shortcuts don't fire while typing in the location picker.
- Documented in the README.

## Pointers
`src/lib/utils/clock.ts` exposes `seek`, `setSpeed`, `goLive`; store actions are in `src/store/runtime.tsx`.
