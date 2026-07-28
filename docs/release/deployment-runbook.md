# Deployment runbook

The app is a Node-served Next.js 16 static-prerendered site. Required runtime:
Node `>=22`, pnpm `11.9.0`. Use a clean checkout, `pnpm install
--frozen-lockfile`, `pnpm build`, then `pnpm start --hostname 127.0.0.1 --port
<isolated-port>` for a local production dry-run. No application environment
variable is currently required.

## Temporary public Demo RC record

- Hosting platform: Vercel Hobby, connected to GitHub `main`.
- Public Demo RC URL: `https://editorial-webgl-portfolio.vercel.app/`.
- Deployment source: merge commit `84a4c02` on `main`.
- Date: 2026-07-28.
- Access boundary: the stable Vercel production-domain alias is public; the
  generated deployment and branch URLs are Vercel-authenticated and must not
  be shared as the public Demo URL.
- SEO boundary: `noindex, nofollow`, `robots.txt` disallow-all, and the safe
  development canonical/OG base remain intentional until a real domain and
  approved assets exist.
- Rollback: use Vercel Deployments to promote the last known-good `main`
  deployment, or revert the corresponding GitHub commit and let Vercel rebuild.

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
| Hosting platform | Vercel Hobby hosts the temporary Demo RC from GitHub `main`; Public Production host approval remains open | Demo RC: release owner; Public Production: **unassigned** |
| Node / pnpm | Node `>=22`, pnpm `11.9.0` | Release engineering: **unassigned** |
| Build / start | `pnpm build`; `pnpm start --hostname <host> --port <port>` | Release engineering: **unassigned** |
| Environment variables | `NEXT_PUBLIC_SITE_URL`; diagnostics flag stays unset in production | Environment owner: **unassigned** |
| Cache invalidation | Vercel automatically redeploys `main`; manually promote the last known-good deployment for rollback | Demo RC: release owner; Public Production: **unassigned** |
| Health check | `GET /` plus `/robots.txt`, `/sitemap.xml`, `/icon.svg`; no external monitor configured | Demo RC: release owner; Monitoring owner: **unassigned** |
| Uptime / error monitoring | Not configured | Monitoring owner: **unassigned** |
| Rollback | Promote the last known-good Vercel deployment or revert the Git commit and redeploy | Demo RC: release owner; Public Production: **unassigned** |
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
This local dry-run preceded the temporary public Demo RC deployment recorded
above. It is not Public Production authorization.
