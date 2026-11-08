# Contributing to OVERHEAD

Thanks for helping make the sky a little more legible. This guide gets you from clone to pull request.

## Setup

Requirements: **Node ≥ 22.6** (24 recommended) and npm.

```bash
git clone https://github.com/aluinn/overhead.git
cd overhead
npm install
npm run dev          # http://localhost:3000
```

No API keys, no `.env` needed. If CelesTrak is unreachable (or rate-limits you) the app falls back to the bundled
sample dataset in `public/data/sample-gp.json`.

> **Be kind to CelesTrak.** It refreshes data about every 2 hours and blocks clients that re-download more often.
> The API routes cache in memory and on disk (`$TMPDIR/overhead-cache`); please don't write scripts that bypass this.
> `npm run fetch-sample` downloads several large files, so run it rarely.

## Everyday commands

| Command              | What it does                                      |
| -------------------- | ------------------------------------------------- |
| `npm run dev`        | Dev server with hot reload                        |
| `npm run lint`       | ESLint                                            |
| `npm run typecheck`  | `tsc --noEmit` (strict mode)                      |
| `npm test`           | Vitest unit tests                                 |
| `npm run test:e2e`   | Playwright smoke test (builds and serves the app) |
| `npm run build`      | Production build                                  |
| `npm run bench`      | Propagation benchmark (numbers in `docs/PERFORMANCE.md`) |

CI runs lint, typecheck, unit tests and build on every push and pull request. Please run them locally first.

## Project layout

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md). In short: server routes in `src/app/api`, pure orbital maths in
`src/lib/orbital` (unit-tested, no DOM), the SGP4 worker in `src/workers`, three.js objects in `src/components/globe`,
and the HUD in `src/components/{hud,sky,feed,share}`.

## Branch naming

Branch from `main` using `<type>/<short-kebab-description>`:

- `feat/orbit-trail-colours`
- `fix/radar-east-west-flip`
- `docs/performance-numbers`
- `refactor/position-stream`

## Commit convention

We use [Conventional Commits](https://www.conventionalcommits.org):

```
<type>(<optional scope>): <imperative summary, lower-case, no trailing period>

<optional body: what and why>
```

Types: `feat`, `fix`, `docs`, `test`, `refactor`, `perf`, `build`, `ci`, `chore`.
Scopes used so far: `globe`, `data`, `sky`, `feed`, `share`, `worker`, `docs`.

Examples: `feat(sky): add elevation-mask slider`, `fix(data): handle CelesTrak 403 with back-off`.

## Pull requests

1. Keep PRs focused: one change, with tests where logic is involved.
2. Orbital maths must come with a unit test against a known value (see `tests/fixtures`).
3. UI changes: attach a screenshot or short clip, and check the layout at phone width.
4. Update `CHANGELOG.md` under **Unreleased** for anything user-visible.
5. No new runtime dependencies without discussing it in an issue first. The dependency list is deliberately tiny.

## Where to start

Look for issues labelled **good first issue**; ready-to-file drafts live in [`docs/issues`](docs/issues).

## Code of Conduct

Participation is governed by our [Code of Conduct](CODE_OF_CONDUCT.md).
