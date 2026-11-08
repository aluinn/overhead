---
title: "Make the app installable and keep the last data offline"
labels: [enhancement]
---

## Context
Today, offline falls back to the small bundled sample. If the user has visited before, we can do much better.

## Task
- Add a web manifest and a minimal service worker (no new dependency; hand-written is fine).
- Cache-first for `/textures/*` and the app shell; stale-while-revalidate for `/api/gp/*` responses so the last real catalog is available offline.
- Show "CACHED · <age>" in the legend when serving from the SW cache.

## Acceptance
- Lighthouse PWA installability passes.
- Airplane-mode reload shows real (not sample) objects after one prior visit.
- Documented in `docs/DATA_SOURCES.md` (fallback matrix).
