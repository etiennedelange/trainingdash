# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

A single athlete: the owner (Etienne), who connects their own Strava account. The app is gated by `ALLOWED_ATHLETE_ID` so only that one person can use a given deployment — it is a personal tool, not a multi-tenant product, though a friend could self-host their own separate instance from the same codebase.

## Product Purpose

A personal dashboard that mirrors an athlete's Strava activity with near-instant live updates: an upload appears on the dashboard about a second after it lands on Strava, with no polling and no manual refresh. It also gives the athlete a progress view (weekly distance, workout mix) that Strava's own app doesn't surface in this form.

## Positioning

Two things a generic Strava viewer or the stock Strava app doesn't combine: (1) near-real-time arrival — a WebSocket-pushed update roughly a second after upload, driven by Strava's webhook plus a Cloudflare Durable Object, not polling; and (2) a lightweight progress/gamification layer (streaks, weekly volume trends, sport mix) on top of raw activity data. Both the live-arrival delight and the progress framing are equally core to the pitch — this isn't just "Strava data in a nicer UI."

## Operating Context

- Single Cloudflare Worker serves both the SPA and the API/webhook; D1 is the datastore; a Durable Object holds live WebSocket connections.
- Installable PWA (offline shell via `vite-plugin-pwa`) plus Web Push notifications on activity arrival.
- Strava's webhook constraint shapes the backend: the callback must return 200 within two seconds, so activity fetch/upsert/notify happens in `ctx.waitUntil()` after acknowledging.
- Current surfaces: activity feed (`/`, `/activities`), activity detail with a MapLibre route map (`/activity/$id`), and a progress view (`/progress`) with weekly distance and sport-mix charts.
- Account/connection state (Connect with Strava, Log out) lives in the nav (`Shell`, `AccountStatus`).

## Capabilities and Constraints

- Built with React 19 + TypeScript (Vite), TanStack Router/Query, Tailwind 4, Motion, ECharts, MapLibre GL for route maps.
- Backend: Hono on Cloudflare Workers, D1, Durable Objects, Web Push.
- Single-athlete access control by design (`ALLOWED_ATHLETE_ID`); not built for multi-user auth/roles.
- No hard brand constraint from Strava today — free to establish its own visual identity rather than mirroring Strava's brand.

## Evidence on Hand

- README.md documents the stack, live-update architecture, and setup/deploy flow.
- No existing DESIGN.md — the current visual system (Tailwind tokens, `Shell`, `StatTile`, `ActivityRow`, `MixBar`, chart components) is incumbent implementation evidence only, not yet documented as a design system.

## Product Principles

1. Live arrival is the headline feel — updates should read as "it just happened," not "I refreshed and it's there."
2. Progress/gamification stays lightweight and honest — real derived stats (distance, mix, trends), not invented achievements or leaderboards (single-athlete, no social layer).
3. It's a personal tool first: optimize for the owner's own workflow and taste over generic onboarding or multi-user polish.
4. No inherited brand constraints — the visual identity is free to be established/evolved in dedicated design work, independent of Strava's own branding.
