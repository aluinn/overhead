# Security Policy

## Supported versions

OVERHEAD is a young project. Only the latest commit on `main` (and the deployment built from it) receives fixes.

## Reporting a vulnerability

**Please do not open a public issue for security problems.**

Use GitHub's private reporting instead: go to the repository's **Security** tab → **Report a vulnerability**
(<https://github.com/aluinn/overhead/security/advisories/new>). Include:

- what you found and where (file, route, or UI flow),
- steps to reproduce, and the impact you expect,
- any suggested fix.

You can expect an acknowledgement within a few days. Once a fix is released we are happy to credit you in the
changelog unless you prefer to stay anonymous.

## Scope and design notes

- OVERHEAD has **no accounts, no database and no secrets**. The server only fetches public orbital data from
  CelesTrak and caches it.
- The browser **never contacts CelesTrak directly**; only the `/api/gp/[group]` and `/api/conjunctions` route
  handlers do, and the `[group]` parameter is validated against a fixed allow-list (no user-controlled upstream URLs).
- A visitor's location is processed **entirely in the browser**. It is never sent to the server. If remembered, it is
  stored in the visitor's own `localStorage`.
- The share image is composed on a client-side canvas; nothing is uploaded.

Reports about the third-party data feeds themselves should go to [CelesTrak](https://celestrak.org).
