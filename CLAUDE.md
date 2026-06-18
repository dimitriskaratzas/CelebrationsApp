# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

**Celebrations** — a Greek nameday & birthday tracker. Anonymous-default, offline-first.
A monorepo with two deployables that talk over JSON/HTTPS:

- `backend/` — ASP.NET Core 10 (C# 13), Clean Architecture, EF Core + Postgres, deployed via Docker on Render. Live at `celebrations-api.onrender.com`.
- `mobile/` — Expo SDK 54 / React Native 0.81 (TypeScript strict), Android-only, file-based routing via expo-router.
- `design_handoff_celebrations/` — "Aegean Noon" design tokens + browser prototypes (reference only, not production code).
- `docs/superpowers/{plans,specs}/` — the live source of truth for what's built and what's next. `NAMEDAY_SPEC.md` is an early spec, superseded by these.

## Common commands

Backend (`cd backend`):
```bash
dotnet run --project Api      # run the API locally
dotnet test                   # ~100 xUnit tests, ~5s; InMemory provider, no DB needed
dotnet test --filter "FullyQualifiedName~SomeTestClass"   # single class / test
```
Local backend first-run needs user-secrets for `Jwt:Key` and `ConnectionStrings:DefaultConnection`, and the schema applied from `backend/database/create_tables.sql` (hand-authored — there are no EF migrations). See `backend/README.md`.

Mobile (`cd mobile`):
```bash
npm install
npx expo start --tunnel       # run; use --offline for type-only iteration
eas update --branch main --platform android --message "<note>"   # ship JS-only changes
eas build --profile preview --platform android                   # native changes (new package/plugin/app.json native field)
```

## Architecture you can't see from one file

- **Offline-first sync is the core invariant.** The mobile app's local SQLite (`expo-sqlite`) is the source of truth. Writes go to an **outbox** table; a sync engine flushes FIFO with exponential backoff. Non-retryable 4xx codes (`FREE_TIER_CAP`, `VALIDATION`) mark an entry *blocked* so newer writes flow past it. Pulls use `GET /api/favorites?since=` with a `(updatedAt, id)` cursor + `hasMore` flag. When touching favorites or sync, preserve this model — don't add a write path that bypasses the outbox.
- **Auth is anonymous-default.** First launch POSTs `/api/auth/anonymous`; the refresh token lives in `expo-secure-store`. There is no real signup in v1 — `auth/{sign-in,register}.tsx` are Phase-4 stubs. axios has a 401→refresh interceptor.
- **Errors are RFC 7807 ProblemDetails** (`application/problem+json`) with a machine-readable `code` extension. Mobile reads `body.code` / `body.title`, **never** `body.error`. Keep new backend errors in this shape (see `Application/.../ErrorCodes`).
- **Backend layering** (Clean Architecture, dependencies point inward): `Domain` (entities, `Result<T>`) ← `Application` (use cases, interfaces, DTOs) ← `Infrastructure` (EF Core, repos, JWT, BCrypt, hosted jobs) ← `Api` (controllers, middleware, `Program.cs`).
- **Timestamps are TIMESTAMPTZ end-to-end**, `Kind=Utc` enforced. Don't introduce local/unspecified `DateTime`.
- **Design tokens have one home:** `mobile/lib/ui/theme.ts` (active theme "Aegean Noon"). Don't hardcode colors/fonts in screens — pull from the theme.

## Deploy

- Backend auto-deploys on push to `master` via Render (`backend/Dockerfile`, runs as non-root). Connection string uses the Supabase **session pooler** (IPv4), not the direct host (IPv6-only).
- Mobile: `eas update` for JS-only; `eas build` for native changes.

## Conventions

- Feature work on `feature/<name>` branches off `master`. Never push directly to `master` — open a PR.
- Commit messages: imperative present tense, no `Co-Authored-By` trailer.
- Mobile has no formal test suite yet (introduced in Plan 4). Backend changes should keep `dotnet test` green.
