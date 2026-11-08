---
title: "Search for an object by name or NORAD ID"
labels: [good first issue, enhancement]
---

## Task
Add a search box (press `/` to focus) that matches names (prefix, then substring) and NORAD IDs over the loaded catalog, shows the top 8, and on selection sets `selected` so the camera flies to it.

## Notes
- The catalog (`store.catalog`) has `names` and `ids`; build a lowercase name array once per catalog, not per keystroke.
- Debounce is unnecessary at 19k entries; a simple loop is fine.

## Acceptance
- Works with only the offline sample loaded.
- Escape clears and blurs.
