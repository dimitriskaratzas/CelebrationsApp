# Plan 3 — Mobile MVP Design Spec

**Status:** Draft
**Date:** 2026-05-12
**Author:** dimkaratz85 + Claude

---

## 1. Goal

Ship an Android-only Expo app that lets the user see and manage their nameday/birthday favorites end-to-end against the live backend at `https://celebrations-api.onrender.com`. The app is offline-first: SQLite is source of truth, writes go through a local outbox, and a sync engine reconciles with the server using the `?since=` cursor exposed in Plan 2.

The visible value at the end of Plan 3 is a working **Today** screen showing who is celebrating today plus a 7-day lookahead, populated from a small bundled stub of common Greek namedays. The structure laid down here is the same structure the production app will keep — not a throwaway prototype.

---

## 2. Locked decisions

| Decision | Choice | Rationale |
|---|---|---|
| Auth UX | Anonymous-default on launch; stub `Sign in / Create account` screens reachable from Settings | Matches backend Plan 1; visible auth path without the contact-import complexity |
| Sync strategy | Offline-first: SQLite source of truth + outbox + `?since=` cursor | Final form; alternative was throwaway online-only that we'd rip out in Plan 4 |
| Folder structure | Feature-folders (`features/<name>/{screens,components,hooks,db}`) + shared `lib/` for cross-cutting | Matches the final shape once Plan 4+ piles on contacts, notifications |
| Run target | EAS Build dev client + EAS Update from day one, **Android-only** | User has Expo account `dimkaratz`; iOS deferred |
| Backend URL | Live Render service `https://celebrations-api.onrender.com/api` | LAN-IP path rejected — we have a real URL now |
| Today screen layout | Two sections: "Celebrating today" + "Coming up this week" | Solves the empty-state problem when no favorite celebrates today |
| Add Favorite UX | Hybrid auto-detect with confirm step | After typing the display name, show "Will celebrate as Γιώργος (23/04). Change?" |
| Display name | `Celebrations` (English in launcher) | UI strings stay Greek |
| Free-tier cap | 10 favorites (enforced by backend) | Mobile mirrors the message but server is authoritative |

---

## 3. Tech stack

- **Expo SDK** 55+
- **expo-router** (file-based routing under `app/`)
- **TypeScript** strict
- **expo-sqlite** for local DB (source of truth)
- **expo-secure-store** for token storage (access + refresh tokens, never AsyncStorage)
- **axios** for HTTP (interceptors for auth refresh)
- **@react-native-community/netinfo** for online detection
- **date-fns** for date math (lightweight, no ICU baggage)
- **EAS Build + EAS Update** for distribution

No state-management library yet — local component state + a single `SyncContext` is enough for Plan 3. Add Zustand/Jotai later if real shared state shows up.

---

## 4. Folder structure

```
mobile/
├── app/                              # expo-router screens (thin — delegate to features)
│   ├── _layout.tsx                   # Root layout: SecureStore bootstrap, anon auth, sync init
│   ├── (tabs)/
│   │   ├── _layout.tsx               # Bottom tab nav: Today / Favorites / Settings
│   │   ├── index.tsx                 # Today  → re-exports features/today/screens/TodayScreen
│   │   ├── favorites.tsx             # Favorites list
│   │   └── settings.tsx              # Settings
│   ├── favorite/[id].tsx             # Edit favorite
│   ├── favorite/new.tsx              # Add favorite
│   ├── auth/sign-in.tsx              # Stub
│   └── auth/register.tsx             # Stub
├── features/
│   ├── today/
│   │   ├── screens/TodayScreen.tsx
│   │   ├── components/CelebratingCard.tsx
│   │   ├── hooks/useTodayList.ts     # Reads SQLite + stub catalog, computes today/week
│   │   └── namedays/
│   │       ├── stub-namedays.json    # ~50 common Greek names with fixed dates
│   │       └── easter.ts             # Orthodox Easter computation + moveable feasts
│   ├── favorites/
│   │   ├── screens/{FavoritesListScreen,AddFavoriteScreen,EditFavoriteScreen}.tsx
│   │   ├── components/{FavoriteRow,RelationshipPicker,NamedayConfirm}.tsx
│   │   ├── hooks/{useFavorites,useAddFavorite,useNamedayMatch}.ts
│   │   └── db/favorites.repo.ts      # Local SQLite repo for favorites
│   ├── settings/
│   │   └── screens/SettingsScreen.tsx
│   └── auth/
│       ├── hooks/useAuth.ts          # Token state, refresh logic
│       └── api/auth.api.ts           # Calls /api/auth/anonymous, refresh, etc.
└── lib/
    ├── api/
    │   ├── client.ts                 # axios instance with auth interceptor
    │   └── error.ts                  # Maps backend error contracts to UI states
    ├── db/
    │   ├── index.ts                  # expo-sqlite singleton + migrations runner
    │   └── migrations/0001_init.sql
    ├── sync/
    │   ├── engine.ts                 # Outbox flusher + pull-with-cursor + NetInfo listener
    │   ├── outbox.ts                 # Outbox CRUD
    │   └── types.ts
    ├── auth/
    │   └── tokens.ts                 # SecureStore wrappers
    ├── time/                         # date-fns helpers, Greek locale formatting
    └── ui/                           # Shared components: Button, ScreenContainer, EmptyState
```

`mobile/` is a sibling of `backend/` in the same repo. Decision: monorepo (single repo) keeps backend + mobile aligned per release; matches the Kogli precedent.

---

## 5. Data model (SQLite)

### `favorites` table
Mirrors the backend Favorite entity. Client-generated UUIDs (id is a TEXT primary key).

| column | type | notes |
|---|---|---|
| `id` | TEXT PRIMARY KEY | UUID, client-generated |
| `display_name` | TEXT NOT NULL | User-typed (e.g. "Πατέρας") |
| `nameday_key` | TEXT NOT NULL | Canonical name key (e.g. "georgios") matching the catalog |
| `birth_date` | TEXT NULL | ISO date `YYYY-MM-DD` or null |
| `relationship` | TEXT NULL | One of the constrained enum values |
| `notes` | TEXT NULL | |
| `updated_at` | TEXT NOT NULL | ISO timestamp, mirrors server |
| `deleted_at` | TEXT NULL | Soft delete tombstone |
| `dirty` | INTEGER NOT NULL DEFAULT 0 | 1 = has unsynced local changes |

Index on `(deleted_at, nameday_key)` for fast Today lookups; index on `dirty` for outbox queries.

### `outbox` table
One row per pending mutation. Survives app restart.

| column | type | notes |
|---|---|---|
| `id` | INTEGER PRIMARY KEY AUTOINCREMENT | |
| `op` | TEXT NOT NULL | `create` \| `update` \| `delete` |
| `favorite_id` | TEXT NOT NULL | FK by convention to `favorites.id` |
| `payload_json` | TEXT NULL | Full request body for `create`/`update`; null for `delete` |
| `created_at` | TEXT NOT NULL | |
| `attempts` | INTEGER NOT NULL DEFAULT 0 | For backoff |
| `last_error` | TEXT NULL | For debugging |

### `sync_state` table (single row, key-value)

| key | value |
|---|---|
| `last_synced_at` | ISO timestamp passed as `?since=` on the next pull |
| `user_id` | The anonymous (or claimed) user ID |

### Migrations

Versioned `.sql` files under `lib/db/migrations/`. A `schema_migrations(version INTEGER, applied_at TEXT)` table tracks what's been applied. Migrations run idempotently on app boot inside `_layout.tsx` before any screen mounts.

---

## 6. Sync engine

A single module `lib/sync/engine.ts` owns sync. Responsibilities:

1. **Outbox flush** — On boot, on network-online event, and after any local write: try each outbox entry in FIFO order. POST/PUT/DELETE against `/api/favorites`. On success, delete the outbox row; on failure, increment `attempts` and back off (exponential: 2s, 4s, 8s, …, capped at 5 min). 4xx (validation) drains immediately to a "stuck" UI state; 5xx and network errors retry.
2. **Pull-with-cursor** — On boot (after flush completes) and every N minutes while foregrounded: `GET /api/favorites?since={last_synced_at}`. Apply `favorites[]` upserts to SQLite (server `updated_at` wins on conflict), apply `deletions[]` as local soft-delete or row removal. Set `last_synced_at = response.syncedAt`.
3. **Conflict resolution** — Server-wins. A favorite with a local outbox entry but a newer server `updated_at` keeps the outbox entry (will overwrite the server on next flush) — the user's intent wins, but only after their write hits the server. The outbox is the only client-side conflict story we need at this scale.
4. **Auth refresh** — Sync calls go through `lib/api/client.ts` which on 401 refreshes the token then retries once. Persistent 401 (refresh failed) → bubbles up as a "sign in to recover" UI state on the relevant screen, but Plan 3 just logs to console because anonymous users never legitimately 401 (their refresh token lives 30 days).
5. **Listeners** — NetInfo subscribed at boot; `AppState` listener triggers a pull on foreground.

UI exposes a small `SyncContext` reading from the engine: `isSyncing`, `lastSyncedAt`, `pendingCount`. Today screen shows a subtle dot when `pendingCount > 0`.

**Out of scope for Plan 3:** background sync via expo-task-manager (handled in Plan 5 alongside notifications), full-text search, large-list virtualization.

---

## 7. Authentication flow

```
App boot
  ↓
SecureStore.get("refreshToken")
  ↓
  ├── present → POST /api/auth/refresh → store new tokens
  │             on fail → fall through to anonymous
  └── absent  → POST /api/auth/anonymous → store tokens + user.id
  ↓
sync_state.user_id = response.user.id
sync engine boots
```

- Tokens live in `expo-secure-store` (Keychain/Keystore-backed). Never in AsyncStorage; never persisted in SQLite.
- `lib/api/client.ts` (axios instance) reads access token from a hot in-memory ref maintained by `useAuth`. On 401: queue concurrent requests, hit `/api/auth/refresh`, retry queue, fail all if refresh fails.
- Settings screen has two buttons routed to `auth/sign-in.tsx` and `auth/register.tsx` — both render `<EmptyState>Coming soon — Plan 4.</EmptyState>` with a back button. No form, no API wiring. They prove the navigation path exists.

---

## 8. Screens

### 8.1 Today (`features/today/screens/TodayScreen.tsx`)

Two sections in a `SectionList`:

**Section 1 — Γιορτάζουν σήμερα** (`Celebrating today`)
- Header: `Σήμερα, Πέμπτη 12 Μαΐου` + the saint(s) of the day from the stub catalog (e.g. "Άγιος Ἐπιφάνιος").
- Rows: favorites whose `nameday_key` resolves to today's date, or whose `birth_date` is `MM-DD == today`. Show display name + relationship chip + tiny "Είναι γενέθλια" / "Είναι ονομαστική" tag.
- Empty state: "Κανείς δεν γιορτάζει σήμερα 🌿" (per memory rule, no emoji unless asked — replace with text-only state in implementation, but design intent is a calm empty state).

**Section 2 — Έρχονται αυτή την εβδομάδα**
- Rows: favorites whose next celebration falls in the next 7 days, sorted by date, capped at 10. Each row shows display name, the day-name + date (e.g. "Σάββατο 14/05"), and which celebration it is.
- Empty if section 1 has content and no upcoming events; otherwise just absent.

A single hook `useTodayList(today: Date)` returns `{ today: TodayItem[]; upcoming: TodayItem[]; loading }`. Reads favorites from SQLite + resolves namedays against the stub catalog. Pure function, no API calls.

### 8.2 Favorites list (`features/favorites/screens/FavoritesListScreen.tsx`)

- `FlatList` of all live (`deleted_at IS NULL`) favorites, sorted alphabetically.
- Row: display name, relationship chip, next celebration date.
- Tap row → `favorite/[id].tsx` edit screen.
- Header right: "+" button → `favorite/new.tsx`.
- Pull-to-refresh triggers a sync pull (not a flush — flush happens on its own).
- Empty state: "Πρόσθεσε τον πρώτο σου αγαπημένο" with a CTA button.

### 8.3 Add favorite (`favorite/new.tsx` → `features/favorites/screens/AddFavoriteScreen.tsx`)

Form fields in order:

1. **Display name** (free text, required, 1–80 chars). On blur, run auto-detect.
2. **Nameday confirmation** — shows after auto-detect. Two sub-states:
   - **Auto-matched:** card reading `Θα γιορτάζει ως Γιώργος (23/04)`, with `Αλλαγή ονόματος γιορτής` link.
   - **Not matched:** `Δεν βρέθηκε γιορτή για αυτό το όνομα. Επίλεξε όνομα γιορτής ή προσπέρασε.` Picker opens the catalog.
   - User can also pick "Καμία γιορτή" (no nameday). In that case `nameday_key = ''` and the favorite only triggers via birth_date.
3. **Birthday** (optional date picker, day+month required, year optional). Stored as `YYYY-MM-DD`; if year is unknown, use `0001` as a sentinel — UI treats `year == 0001` as "year unknown" and shows "Μήνας/Ημέρα" only.
4. **Relationship** (constrained enum picker, optional): `parent | child | sibling | spouse | grandparent | friend | colleague | other`. Labels in Greek; values sent to backend in English.
5. **Notes** (optional, free text, multiline).

Save button:
- Disabled if no display name OR (no nameday_key AND no birth_date) — backend Plan 2 already enforces this, but mobile guards too.
- On save: writes to SQLite (`dirty=1`), enqueues a `create` outbox entry, kicks the sync engine, navigates back.
- If the local favorites count is already 10 and the user is on free tier, show a sheet: "Έφτασες το όριο των 10 αγαπημένων στη δωρεάν έκδοση." Currently always free — entitlement comes from a stub.

**Auto-detect logic (`hooks/useNamedayMatch.ts`):**
1. Normalize the input: lowercase, strip accents, collapse whitespace, take the first whitespace-separated token (so "Γιώργος Παπαδόπουλος" → "γιωργοσ" → "georgios").
2. Look up in the stub catalog (Plan 3 stub maps ~50 normalized forms to `nameday_key`). Greeklish forms (e.g. "giorgos") map too — the stub includes those variants explicitly.
3. If single match → auto-suggest. If multiple → present picker. If none → show "no match" state.

**Not in Plan 3:** real Greeklish phonetic matcher, full catalog of ~3000 Greek namedays, custom user-added namedays. Those are Plan 4.

### 8.4 Edit favorite (`favorite/[id].tsx`)

Same form as Add, prefilled. On save → SQLite update + `update` outbox entry. On delete (header right) → SQLite `deleted_at` set + `delete` outbox entry. Confirm delete with a sheet.

### 8.5 Settings (`features/settings/screens/SettingsScreen.tsx`)

Sections:
- **Λογαριασμός** — shows anonymous status, two buttons: `Σύνδεση` → `/auth/sign-in`, `Δημιουργία λογαριασμού` → `/auth/register`. Both stubs.
- **Συγχρονισμός** — last sync time, pending count, manual `Συγχρονισμός τώρα` button.
- **Σχετικά** — app version (from `expo-application`), build channel.

---

## 9. Stub namedays catalog

`features/today/namedays/stub-namedays.json` — flat array of entries:

```json
{
  "nameday_key": "georgios",
  "primary_form": "Γιώργος",
  "all_forms_normalized": ["γιωργοσ", "γιωργος", "georgios", "giorgos", "γιωργια", "γεωργιος"],
  "celebration": { "type": "fixed", "month": 4, "day": 23 },
  "saint": "Άγιος Γεώργιος"
}
```

`celebration.type`:
- `"fixed"` → `month`+`day` (Gregorian)
- `"easter_offset"` → `offset` (integer days from Orthodox Pascha). Used for moveable feasts (Πάσχα, Αγίου Πνεύματος, etc.)

Plan 3 ships 30–50 of the most common Greek given names. Selection criteria: top names by frequency in modern Greece (Γιώργος, Μαρία, Ιωάννης/Γιάννης, Ελένη, Κωνσταντίνος, Δημήτρης, Σοφία, Νικόλαος, …). Full list curated by hand during implementation; pinned in the plan, not the spec.

### Easter computation (`features/today/namedays/easter.ts`)

Orthodox Pascha via Meeus's Julian algorithm (the standard public-domain formula). Takes a year, returns a Gregorian date. Used at app boot to resolve all `easter_offset` celebrations for the current year (cached for the session).

---

## 10. EAS configuration

### `mobile/app.json`

```jsonc
{
  "expo": {
    "name": "Celebrations",
    "slug": "celebrations",
    "version": "0.1.0",
    "orientation": "portrait",
    "userInterfaceStyle": "light",
    "scheme": "celebrations",
    "android": {
      "package": "com.dimkaratz.celebrations",
      "adaptiveIcon": { "backgroundColor": "#FFFFFF" }
    },
    "plugins": ["expo-router", "expo-secure-store"],
    "runtimeVersion": { "policy": "appVersion" },
    "updates": { "url": "https://u.expo.dev/<EAS-PROJECT-ID-FROM-FIRST-BUILD>" },
    "extra": { "router": {}, "eas": { "projectId": "<FROM-FIRST-BUILD>" } },
    "owner": "dimkaratz"
  }
}
```

### `mobile/eas.json`

```jsonc
{
  "cli": { "version": ">= 16.0.0", "appVersionSource": "remote" },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "android": { "buildType": "apk" },
      "env": { "EXPO_PUBLIC_API_URL": "https://celebrations-api.onrender.com/api" }
    },
    "preview": {
      "distribution": "internal",
      "channel": "main",
      "android": { "buildType": "apk" },
      "env": { "EXPO_PUBLIC_API_URL": "https://celebrations-api.onrender.com/api" }
    },
    "production": {
      "channel": "main",
      "android": { "buildType": "app-bundle" },
      "env": { "EXPO_PUBLIC_API_URL": "https://celebrations-api.onrender.com/api" }
    }
  }
}
```

iOS profiles intentionally absent (Android-only for now).

### First-build dance

1. `cd mobile && npm install`
2. `eas init` → creates the project on the Expo side, writes the `projectId` and `updates.url` into `app.json`.
3. `eas build --profile development --platform android` → ~15 min, installable APK link.
4. Install on phone, run `npx expo start --dev-client` from the dev machine, scan QR → app loads the JS bundle from Metro.
5. From there, JS-only changes → `eas update --branch main`. Native/plugin changes → rebuild.

---

## 11. Environment variables

Only one: `EXPO_PUBLIC_API_URL`. Defined per-profile in `eas.json` (and for `npx expo start`, picked up from a local `.env` that's gitignored). Accessed via `process.env.EXPO_PUBLIC_API_URL` directly — the `EXPO_PUBLIC_` prefix makes it available in the client bundle.

`.env.development` (gitignored):
```
EXPO_PUBLIC_API_URL=https://celebrations-api.onrender.com/api
```

No secrets in the client bundle ever. JWT keys, DB passwords, etc. live only on Render.

---

## 12. Error handling & states

- **No network on launch:** Boot proceeds. SQLite serves cached data. Sync engine waits for connectivity.
- **First launch + no network:** Anonymous auth can't run. App stays on a single screen "Χρειάζεται σύνδεση στο διαδίκτυο για να ξεκινήσει η εφαρμογή για πρώτη φορά." with a retry button.
- **Sync stuck (4xx on outbox entry):** Show a banner on the Favorites list: "Κάποιες αλλαγές δεν αποθηκεύτηκαν." Tap → diagnostic sheet listing stuck items with `last_error`. User can delete the local entry or retry. Plan 3 ships the banner + sheet but the diagnostic is bare-bones; richer UI is Plan 4.
- **Cap reached on backend (server returns 402):** Show the sheet from §8.3. The local SQLite write has already happened — we DO NOT roll it back; we mark the outbox entry as stuck and surface the cap message. The user can delete some local favorites to bring count to 10 and the stuck entry retries automatically. (This means SQLite can temporarily contain 11 favorites — accepted trade-off; cleaner UX than rolling back.)

---

## 13. Out of scope (deferred)

- Login / Register form wiring (Plan 4 — bundled with the contacts import + claim flow)
- Contacts import + Greeklish-aware nameday inference (Plan 4)
- Push notifications + scheduling (Plan 5 — requires native module, EAS Build with notification entitlements)
- Background sync via expo-task-manager (Plan 5)
- Full ~3000-name Greek nameday catalog (Plan 4)
- Custom user-added namedays (Plan 4)
- iOS build (Plan 6 or later, requires Apple Developer)
- Tests beyond a smoke render-test per screen (Plan 4)
- Dark mode (Plan 6+)
- In-app entitlement / Stripe / IAP (Plan 6+)

---

## 14. Risks

| Risk | Mitigation |
|---|---|
| Render cold start (~30s on free plan) blocks app boot UX | Show a "Συνδεόμαστε…" screen with a 5s timeout that falls through to cached data; first anonymous auth retries every 10s in background |
| `expo-sqlite` API surface differs across SDKs | Pin SDK 55+, use the documented `useSQLiteContext` / `useSQLiteAsync` API — wrap all access in `lib/db/index.ts` so a future migration is local |
| Outbox can grow unbounded on a long-offline device | Add a soft cap of 500 entries; surface a banner if exceeded. Not implemented in Plan 3 — just logged. |
| Auto-detect false positives ("Πάρης" → assumed Greek nameday) | Confirm step makes every match user-acknowledged; user can pick "Καμία γιορτή" |
| Anonymous-only means users can't recover after uninstall | Acknowledged. Register/claim flow in Plan 4. Plan 3 users are testers who tolerate this. |
| Sync engine bugs corrupt local data | Migrations are forward-only; we keep a `pre-sync.bak` of the SQLite file on first run of each new app version. Not implemented in Plan 3 — noted for Plan 4. |

---

## 15. Success criteria

Plan 3 is done when:

1. `eas build --profile development --platform android` produces an installable APK.
2. Installed APK on a real Android phone:
   - Launches, silently anonymous-auths against the Render API.
   - Shows Today screen with section headers, even when empty.
   - Add Favorite flow saves a "Γιώργος" with relationship `parent` and birth date, sync flushes to server, server `GET /api/favorites` reflects it.
   - Killing the app and reopening loads the favorite from SQLite (no network needed).
   - Going airplane-mode, adding another favorite, then re-enabling network → the new favorite appears in the next `GET /api/favorites` on the server.
   - Today screen, on a date matching the stub catalog, shows the celebrating favorite under "Γιορτάζουν σήμερα".
3. Settings screen reachable; Sign in / Create account routes resolve to stub screens.
4. No crash, no unhandled rejection, no missing-translation flicker.

When all six bullets are checked, Plan 3 ships, the implementation plan is closed, and Plan 4 (login + contacts import + Greeklish) opens.
