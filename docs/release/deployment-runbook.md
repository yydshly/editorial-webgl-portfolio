# Deployment runbook (dry-run only)

The app is a Node-served Next.js 16 static-prerendered site. It is not
authorized for public deployment. Required runtime: Node `>=22`, pnpm
`11.9.0`. Use a clean checkout, `pnpm install --frozen-lockfile`, `pnpm build`,
then `pnpm start --hostname 127.0.0.1 --port <isolated-port>` for a local
production dry-run. No application environment variable is currently required.

Before public launch: select a real canonical domain; configure
`NEXT_PUBLIC_SITE_URL`; replace approved social assets; configure HTTPS,
gzip/Brotli, immutable cache for `/_next/static/*`, and host operations.
The app sets CSP, nosniff, Referrer-Policy, Permissions-Policy, frame denial,
and disables browser production source maps. Keep noindex until identity and
assets are approved.

Smoke `/`, hashes, robots, sitemap, icon, OG asset, a missing route, WebGL
available/unavailable, reduced motion, context restore, desktop and mobile.
Verify one Canvas/Renderer/Camera/RAF, no dev overlay/hydration/console error,
and no production debug probe. Rollback by immutable release identifier.

RC-03A validated this against `next start` on an isolated port: headers,
OG/icon/robots/sitemap/404, hash navigation, four viewports,
normal/reverse/fast scrolling, reduced motion, unavailable-WebGL fallback and
context restore passed. Production browser source maps are disabled; no `.map`
file is emitted in `.next/static`.

## Ownership and environment decision table

| Decision | Current record | Owner / status |
| --- | --- | --- |
| `NEXT_PUBLIC_SITE_URL` / canonical domain | Safe default `https://dev-host-01.example`; no real domain selected | Domain owner: **unassigned** |
| Hosting platform | Node-served Next.js runtime is validated locally; platform not selected | Host owner: **unassigned** |
| Node / pnpm | Node `>=22`, pnpm `11.9.0` | Release engineering: **unassigned** |
| Build / start | `pnpm build`; `pnpm start --hostname <host> --port <port>` | Release engineering: **unassigned** |
| Environment variables | `NEXT_PUBLIC_SITE_URL`; diagnostics flag stays unset in production | Environment owner: **unassigned** |
| Cache invalidation | Purge/redeploy immutable release identifier; provider procedure not selected | Host owner: **unassigned** |
| Health check | `GET /` plus `/robots.txt`, `/sitemap.xml`, `/icon.svg`; no external monitor configured | Monitoring owner: **unassigned** |
| Uptime / error monitoring | Not configured | Monitoring owner: **unassigned** |
| Rollback | Revert to the last known-good immutable release | Release owner: **unassigned** |
| Release approval | Requires asset, identity, privacy/copyright and RC-04 sign-off | Approval owner: **unassigned** |
| Emergency offline | Provider-level disable or route to a maintenance response | Incident owner: **unassigned** |

Until these fields are assigned, Demo RC remains the only permitted release
level. No domain, platform, owner, monitoring service, or rollback mechanism
may be invented in deployment configuration.

## RC-04 dry-run record

The Demo RC build was validated from the isolated `NEXT_DIST_DIR=.tmp/rc04-build`
output with `next start` on port `3338`. The six-test production smoke suite
passed, including direct `#books` navigation, full section order, fast forward
and reverse travel, reduced motion, WebGL unavailable, context restore,
security headers, private diagnostics, single Canvas ownership, and a real 404.
This is a local dry-run only; it is not a deployment authorization.
