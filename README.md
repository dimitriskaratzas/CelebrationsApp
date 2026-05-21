# Celebrations

A Greek nameday & birthday tracker. Anonymous-default, offline-first, with a
calm Mediterranean look — the kind of app where you open it, see who's
celebrating today, and send a quick "Χρόνια Πολλά" without thinking about
accounts or sync.

- **Mobile**: Android-only (for now), Expo + React Native, Aegean Noon theme.
- **Backend**: ASP.NET Core (.NET 10), live at
  [`celebrations-api.onrender.com`](https://celebrations-api.onrender.com/api/health).
- **Status**: Plan 3 (mobile MVP + design unification) — see
  [`docs/superpowers/plans/`](docs/superpowers/plans/).

---

## What it does (today)

- **Σήμερα tab.** A hero card with the saint of the day in Greek (Άγιος Γεώργιος,
  Αγία Παρασκευή, …) and the names that celebrate it; below, the favorites of
  yours who are celebrating today, then the next 7 days.
- **Αγαπημένα tab.** Your list of favorites with monogram avatars, a search
  bar (accent-folding, so "γιωργοσ" matches "Γιώργος"), the next-celebration
  date per row, and a 10-favorite free-tier meter.
- **Add / edit favorite.** Type a Greek or Greeklish name → autocomplete +
  auto-detect against a curated 35-name catalog; pick a relationship from a
  bottom-sheet icon grid; optional birthday (single-card three-field input
  with calendar-impossible-date validation).
- **Ρυθμίσεις tab.** Account (anonymous status, sign-in / register stubs),
  Sync (last-synced timestamp, manual refresh), About (version, build, channel).
- **Offline-first.** Everything writes to a local SQLite first, then an outbox
  flushes to the server when the network's around. Pulls are paginated with
  a `(updatedAt, id)` cursor.

Anything not in the list above isn't built yet — see
[Roadmap](#roadmap) for what comes next.

---

## Architecture

```
┌─────────────────┐         JSON over HTTPS         ┌──────────────────────┐
│   mobile/       │  ─────────────────────────────▶ │   backend/           │
│   Expo SDK 54   │  ◀───────────────────────────── │   ASP.NET Core 10    │
│   RN 0.81       │  bearer JWT, ProblemDetails     │   on Render          │
└────────┬────────┘                                 └──────────┬───────────┘
         │ expo-sqlite                                         │ EF Core
         │ + outbox                                            │
         ▼                                                     ▼
   local-first DB                                  Supabase Postgres
   (offline UX)                                    (pooler, IPv4)
```

- **Auth.** Anonymous-default. On first launch, the mobile app POSTs to
  `/api/auth/anonymous` and stores the returned refresh token in
  `expo-secure-store`. There is no signup flow for v1 — login/register screens
  are Phase-4 stubs.
- **Sync.** The mobile app is the source of truth locally. Writes go through
  an outbox table; a sync engine flushes FIFO with exponential backoff,
  non-retryable 4xx codes (`FREE_TIER_CAP`, `VALIDATION`) mark the entry as
  blocked so newer writes can flow past. Pulls use `GET /api/favorites?since=`
  with a `(UpdatedAt, Id)` cursor and a `hasMore` flag for pagination.
- **Errors.** Backend speaks
  [RFC 7807 ProblemDetails](https://www.rfc-editor.org/rfc/rfc7807)
  (`application/problem+json`) with a machine-readable `code` extension —
  mobile reads `body.code` or `body.title`, not `body.error`.

---

## Repo layout

```
CelebrationsApp/
├── backend/                          ASP.NET Core 10, Clean Architecture
│   ├── Domain/                       Entities, value objects, Result<T>
│   ├── Application/                  Use cases, interfaces, DTOs, ErrorCodes
│   ├── Infrastructure/               EF Core, repositories, JWT, BCrypt, hosted jobs
│   ├── Api/                          Controllers, middleware, Program.cs
│   ├── Tests/                        xUnit + FluentAssertions (≈100 tests)
│   ├── database/create_tables.sql    Hand-authored Postgres schema
│   ├── Dockerfile                    Multi-stage, runs as non-root `app` user
│   └── README.md                     Backend setup + deploy notes
├── mobile/                           Expo SDK 54, Android-only
│   ├── app/                          expo-router routes
│   │   ├── (tabs)/                   Σήμερα / Αγαπημένα / Ρυθμίσεις
│   │   ├── favorite/{new,[id]}.tsx   Add / edit screens
│   │   └── auth/{sign-in,register}.tsx  Phase-4 placeholder screens
│   ├── features/                     Feature folders (today, favorites, settings, auth)
│   ├── lib/                          Cross-cutting: api, db, sync, auth, ui, time
│   ├── eas.json                      Build profiles: development, preview, production
│   └── app.json                      platforms: ['android'], expo-router + plugins
├── design_handoff_celebrations/      Aegean Noon design tokens + browser prototypes
│   ├── theme.ts                      Single source of truth for tokens
│   ├── fonts.md                      Plus Jakarta Sans + Manrope wiring
│   ├── README.md                     Per-screen layout specs
│   └── *.html                        Reference prototypes (not production code)
├── docs/superpowers/
│   ├── plans/                        Implementation plans (Plan 1, 2, 3)
│   └── specs/                        Design specs (per plan)
└── NAMEDAY_SPEC.md                   Early product spec — superseded by docs/superpowers/
```

---

## Backend

### Stack

- .NET 10 (preview SDK), C# 13
- ASP.NET Core minimal hosting + controllers
- EF Core 10 with Npgsql, Postgres TIMESTAMPTZ end-to-end (Kind=Utc enforced)
- BCrypt password hashing (work factor 12), JWT bearer (15min access, 30day refresh)
- xUnit + Moq + FluentAssertions, InMemory provider for unit tests
- Deployed via Docker on Render free tier

### Live endpoints

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET    | `/api/health`              | none | Liveness — cheap, no DB |
| GET    | `/api/ready`               | none | Readiness — pings the DB |
| POST   | `/api/auth/anonymous`      | none | Create anonymous user + token pair |
| POST   | `/api/auth/register`       | none | Email + password |
| POST   | `/api/auth/login`          | none | |
| POST   | `/api/auth/refresh`        | none | Race-safe rotation, reuse detection |
| POST   | `/api/auth/logout`         | none | Best-effort refresh revoke |
| POST   | `/api/auth/claim`          | bearer | Promote anonymous → registered |
| POST   | `/api/auth/forgot-password`| none | Always 200 — no email enumeration |
| POST   | `/api/auth/reset-password` | none | Single-use token, 1h TTL |
| GET    | `/api/favorites?since=&limit=` | bearer | Paginated `(updatedAt, id)` cursor |
| POST   | `/api/favorites`           | bearer | Idempotent by client UUID + 10-cap |
| PUT    | `/api/favorites/{id}`      | bearer | |
| DELETE | `/api/favorites/{id}`      | bearer | Soft-delete |

### Local setup

See [`backend/README.md`](backend/README.md) for the long form. Short version:

```bash
cd backend
psql -U celebrations -d celebrations -f database/create_tables.sql
dotnet user-secrets set "Jwt:Key" "$(openssl rand -base64 48)" --project Api
dotnet user-secrets set "ConnectionStrings:DefaultConnection" "Host=localhost;…" --project Api
dotnet run --project Api
dotnet test    # ≈100 tests, ~5s
```

### Deploy

Push to `master` → Render auto-deploys the `backend/Dockerfile`. Service ID
`srv-…` lives under workspace `celebrations`. Connection string uses the
Supabase **session pooler** (`aws-1-eu-west-1.pooler.supabase.com:5432`) —
not the direct host, which is IPv6-only and Render is IPv4.

---

## Mobile

### Stack

- Expo SDK 54, expo-router 6 (file-based routes, `typedRoutes` on)
- React Native 0.81, React 19.1, TypeScript strict
- expo-sqlite (local source of truth), expo-secure-store (tokens)
- axios with bearer auth + 401-refresh interceptor
- date-fns 4 with Greek locale
- expo-linear-gradient for hero / backgrounds
- @expo-google-fonts/plus-jakarta-sans + @expo-google-fonts/manrope
- @react-native-community/netinfo for connectivity-aware sync

### Design system

Tokens live in [`mobile/lib/ui/theme.ts`](mobile/lib/ui/theme.ts). The active
theme is **Aegean Noon**: Hellenic cobalt (`#0F4C81`) accent, amber gold
(`#FFC93C`) hero highlight, whitewashed surfaces, Plus Jakarta Sans for
display, Manrope for body. Sunset Blur is exported as an alternate for a
future ThemeContext swap.

| | Plus Jakarta Sans | Manrope |
|---|---|---|
| Usage | titles, hero counts, date chips | list rows, captions, chips, tabs |
| Weights | 400 / 500 / 700 / 800 | 500 / 600 / 700 / 800 |

The visual vocabulary across all screens:

- **Backgrounds**: vertical gradient `bgTop → bgBottom`
- **Cards**: surface bg, hairline `theme.line` border, radius 20–24
- **Pills**: radius 99, amber `theme.gold` for primary CTAs ("Στείλε →"), cobalt for navigation
- **Icons**: Ionicons (outline) in 34×34 cobalt-soft rounded squares
- **Avatars**: monogram circles with a deterministic two-tone gradient seeded from the name hash; gold ring on nameday-type rows

### Local setup

```bash
cd mobile
npm install
cp .env.example .env.development      # adjust EXPO_PUBLIC_API_URL if needed
npx expo start --tunnel               # or --offline for type-only iteration
```

To run on a real device, install the most recent EAS preview APK on your
Android phone, then push JS changes with `eas update`. Native changes
(new plugins, fonts, app.json native config) require a fresh `eas build`.

### EAS profiles

```jsonc
// eas.json — Android only
{
  "build": {
    "development": { /* dev client APK */ },
    "preview":     { /* internal APK on channel "main" */ },
    "production":  { /* aab on channel "main" */ }
  }
}
```

Workflow for design / JS iteration:

```bash
eas update --branch main --platform android --message "<short note>"
```

Workflow for native changes (new package, plugin, app.json native field):

```bash
eas build --profile preview --platform android
```

---

## Roadmap

| Plan | Status | Summary |
|---|---|---|
| **Plan 1** — Backend foundations | ✅ Shipped | Users, JWT, refresh tokens, password reset, anonymous + claim flow |
| **Plan 2** — Favorites sync | ✅ Shipped | `GET /favorites?since=`, outbox model, idempotency by client UUID, free-tier cap |
| **Plan 3** — Mobile MVP | ✅ Shipped | Today / Favorites / Settings, Aegean Noon design, offline-first sync engine |
| Backend hardening | ✅ Shipped | Transactional cap, refresh-reuse detection, ProblemDetails, tombstone retention, Docker non-root, readiness probe — full senior-code-review pass |
| **Plan 4** — Login + claim + contacts | 🔜 Next | Wire the auth stubs to real flows, import phone contacts, Greeklish phonetic matching, full ~3000-name catalog |
| Plan 5 — Notifications | ⏳ | Local notifications via expo-notifications + background sync |
| Plan 6 — iOS + theme switcher | ⏳ | Requires Apple Developer account; Sunset Blur theme as user-selectable |
| Plan 7 — Premium / IAP | ⏳ | Stripe or RevenueCat; remove the 10-favorite cap for paid users |

Up-to-date specs live in [`docs/superpowers/specs/`](docs/superpowers/specs/),
implementation plans in [`docs/superpowers/plans/`](docs/superpowers/plans/).

---

## Working on this repo

- **Branches**: feature work on `feature/<name>` branches off `master`.
  Never push directly to `master` — open a PR.
- **Tests**: backend ships with `dotnet test`; mobile doesn't have a formal
  test suite yet (Plan 4 introduces Vitest + screen smoke tests).
- **Commits**: imperative present tense, no `Co-Authored-By` trailer.
- **Backend deploy**: auto-deploys on push to `master` via Render.
- **Mobile deploy**: `eas update` for JS-only; `eas build` for native.

---

## License

Private / personal project. No license granted to third parties.
