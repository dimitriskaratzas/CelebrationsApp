# Plan 3 — Mobile MVP Implementation Plan

**Spec:** [`2026-05-12-mobile-mvp-design.md`](../specs/2026-05-12-mobile-mvp-design.md)
**Branch:** `feature/plan-3-mobile-mvp`
**Working dir:** `mobile/` (new sibling of `backend/`)

23 tasks across 6 phases. Each task is independently verifiable. Mark each `[x]` when done.

---

## Phase A — Setup (T1–T4)

### T1. Initialize Expo project
- Run `npx create-expo-app@latest mobile --template default` from repo root.
- Strip the demo content: replace `app/(tabs)/index.tsx` and `app/(tabs)/explore.tsx` with placeholders, remove the welcome banner.
- Confirm `mobile/package.json` has `expo-router` and the script `"start": "expo start"`.
- **Files:** `mobile/` (entire new tree).
- **Accept:** `cd mobile && npx expo start --offline` opens Metro without errors.

### T2. Install dependencies and configure
- `npx expo install expo-sqlite expo-secure-store @react-native-community/netinfo expo-application expo-status-bar expo-constants`
- `npm i axios date-fns`
- `npm i -D @types/node`
- Write `mobile/app.json` per spec §10 (name=Celebrations, slug=celebrations, package=`com.dimkaratz.celebrations`, owner=`dimkaratz`, plugins=`["expo-router","expo-secure-store"]`, runtimeVersion=appVersion).
- Write `mobile/eas.json` per spec §10 (three profiles, Android-only, `EXPO_PUBLIC_API_URL=https://celebrations-api.onrender.com/api`).
- Write `mobile/.env.development` with the same URL; add `.env*` to `mobile/.gitignore`.
- **Accept:** `npx expo prebuild --platform android --no-install` runs without error (proves config is valid). Discard prebuild output.

### T3. Folder scaffolding
- Create empty index files (or `.md` placeholders) for every directory listed in spec §4 under `mobile/features/` and `mobile/lib/`. Empty TS files are fine — exports come in later tasks.
- Add `mobile/tsconfig.json` extending Expo's base, with path alias `@/*` → `./` for clean imports.
- **Accept:** `npx tsc --noEmit` exits 0.

### T4. First EAS dev build
- `eas login` (one-time, user does this; ping if not logged in).
- From `mobile/`: `eas init` (creates the EAS project, writes `extra.eas.projectId` and `updates.url` into `app.json`).
- `eas build --profile development --platform android` → wait ~15 min → get APK link.
- Install APK on Android phone. Verify it opens to the (still-placeholder) home screen.
- Locally: `npx expo start --dev-client`, scan QR from the dev-client app → JS bundle loads.
- **Accept:** Phone shows the placeholder home screen with hot reload working from the dev machine.

---

## Phase B — Foundation (T5–T10)

### T5. SQLite migrations + initial schema
- `mobile/lib/db/index.ts`: singleton `getDb()` using `expo-sqlite`'s `openDatabaseAsync`. Runs migrations on first call.
- `mobile/lib/db/migrations.ts`: reads `schema_migrations` table; applies any unrun `.sql` files in order.
- `mobile/lib/db/migrations/0001_init.sql`: tables `favorites`, `outbox`, `sync_state`, `schema_migrations` per spec §5; indexes on `(deleted_at, nameday_key)` and `(dirty)`.
- **Accept:** A throwaway test screen calls `getDb()` and `SELECT name FROM sqlite_master WHERE type='table'` returns all four tables.

### T6. Token storage + axios client
- `mobile/lib/auth/tokens.ts`: `saveTokens({access, refresh})`, `getTokens()`, `clearTokens()` using `expo-secure-store`.
- `mobile/lib/api/client.ts`: axios instance with `baseURL = process.env.EXPO_PUBLIC_API_URL`. Request interceptor injects `Authorization: Bearer <access>`. Response interceptor: on 401, hits `/api/auth/refresh` with the refresh token, retries the original. Concurrent 401s queue against a single in-flight refresh promise.
- `mobile/lib/api/error.ts`: `toAppError(e)` maps axios errors → `{code, message, status}`.
- **Accept:** Manual call `client.get('/health')` returns `{status:"ok"}` from the live Render URL.

### T7. useAuth + anonymous bootstrap
- `mobile/features/auth/api/auth.api.ts`: `anonymous()` POSTs `/api/auth/anonymous`; `refresh(token)` POSTs `/api/auth/refresh`; returns `{accessToken, refreshToken, user}`.
- `mobile/features/auth/hooks/useAuth.ts`: React context exposing `{user, isReady, isAnonymous}`. On mount: read SecureStore → if refresh token exists, refresh → else `anonymous()` → save tokens → set user + write `sync_state.user_id`.
- **Accept:** App boot creates an anonymous user on first launch; relaunching keeps the same user id (verified by reading `sync_state.user_id`).

### T8. Root layout — boot orchestration
- `mobile/app/_layout.tsx`: `Stack` with a single `(tabs)` group. On mount: run migrations → `AuthProvider` → `SyncProvider`. While `!isReady`, render a `<BootingScreen>` (centered text "Συνδεόμαστε…").
- If no network on first launch (no tokens yet): show a "Χρειάζεται σύνδεση" screen with a Retry button.
- **Accept:** Cold launch on airplane mode after a successful first launch loads the app from cache (because tokens are stored).

### T9. Sync engine — outbox + flush
- `mobile/lib/sync/outbox.ts`: `enqueue({op, favoriteId, payload})`, `peek()`, `markDone(id)`, `markFailed(id, error)`, `count()`.
- `mobile/lib/sync/engine.ts` (partial): `flushOutbox()` walks FIFO, POSTs/PUTs/DELETEs to `/api/favorites`. Exponential backoff per-entry (2/4/8/…/300s). Drains 4xx to "stuck" state. Idempotent — safe to call concurrently (mutex via a single in-flight promise).
- **Accept:** Manually enqueue a `create` for "Test Favorite" while offline, then go online → server reflects the new favorite after flush.

### T10. Sync engine — pull + listeners
- Extend `engine.ts`: `pull()` calls `GET /api/favorites?since={last_synced_at}`, applies upserts + tombstones to SQLite, updates `sync_state.last_synced_at`.
- `SyncProvider`: subscribes to NetInfo (`useNetInfo`) and AppState. On online or foreground → `flushOutbox()` then `pull()`. Exposes `{isSyncing, pendingCount, lastSyncedAt, syncNow()}` via context.
- **Accept:** Adding a favorite on the device flushes to the server; manually editing a server-side favorite (via curl + bearer token) shows up on the device after foregrounding the app.

---

## Phase C — Favorites feature (T11–T15)

### T11. Favorites local repo + hook
- `mobile/features/favorites/db/favorites.repo.ts`: `listLive()`, `getById(id)`, `create(input)`, `update(id, input)`, `softDelete(id)`. `create`/`update`/`softDelete` mark `dirty=1` and enqueue an outbox entry in the same transaction.
- `mobile/features/favorites/hooks/useFavorites.ts`: returns `{favorites, loading, reload}`. Subscribes to a simple in-memory event bus so other parts of the app can `emit('favorites:changed')` after mutations.
- **Accept:** A test screen creating + listing favorites updates immediately without app reload.

### T12. Favorites list screen
- `mobile/features/favorites/screens/FavoritesListScreen.tsx`: FlatList sorted alphabetically, row shows display name + relationship chip + next celebration date. Header `+` button navigates to `/favorite/new`. Pull-to-refresh calls `syncNow()`.
- `mobile/features/favorites/components/FavoriteRow.tsx`: pressable row, opens `/favorite/[id]`.
- Empty state component reused from `lib/ui/EmptyState.tsx`.
- Wire up `mobile/app/(tabs)/favorites.tsx` to render the screen.
- **Accept:** Empty state shows on first launch. After adding favorites (via temporary test button), rows appear sorted.

### T13. Add favorite — form scaffold
- `mobile/app/favorite/new.tsx` renders `AddFavoriteScreen`.
- `mobile/features/favorites/screens/AddFavoriteScreen.tsx`: form fields per spec §8.3 (display name, birthday picker, relationship picker, notes). Save button disabled until valid.
- `mobile/features/favorites/components/RelationshipPicker.tsx`: bottom-sheet or `Modal` picker with the constrained enum and Greek labels.
- Birth date: native date picker; year-unknown toggle → stores `0001` sentinel.
- Save (without auto-detect yet — `nameday_key` always empty for this task) writes via repo and navigates back.
- **Accept:** Can create a favorite with display name only; appears in list.

### T14. Stub namedays + auto-detect confirm
- `mobile/features/today/namedays/stub-namedays.json`: 30–50 entries per spec §9. Curate during this task — start with the top 30 male/female Greek names. Include Greeklish variants in `all_forms_normalized`.
- `mobile/features/favorites/hooks/useNamedayMatch.ts`: `match(input: string)` returns `{matched: Entry} | {matches: Entry[]} | null`. Normalizes (lowercase, strip accents, first token).
- `mobile/features/favorites/components/NamedayConfirm.tsx`: card UI shown after display-name blur. States: matched ("Θα γιορτάζει ως X (DD/MM). Αλλαγή"), multi ("Πολλές γιορτές για αυτό το όνομα. Επίλεξε:"), none ("Δεν βρέθηκε γιορτή. Επίλεξε ή προσπέρασε"), explicit-none ("Καμία γιορτή").
- Wire into AddFavoriteScreen — `nameday_key` is now resolved before save.
- **Accept:** Typing "Γιώργος" → confirm card shows "Γιώργος (23/04)". Typing "Πάρης" with stub catalog not containing it → "Δεν βρέθηκε γιορτή"; user can pick from picker or "Καμία".

### T15. Edit + delete + cap UX
- `mobile/app/favorite/[id].tsx` renders `EditFavoriteScreen` (same form as Add, prefilled). Header right: delete button → confirm sheet → soft-delete.
- Pre-save guard: if `favoritesRepo.countLive() >= 10` and creating, show a sheet "Έφτασες το όριο των 10 αγαπημένων στη δωρεάν έκδοση." and don't proceed.
- Outbox-stuck handling: if a `create`/`update` returns 402, surface a banner on the favorites list "Έχεις φτάσει το όριο. Διέγραψε κάποιους για να συνεχίσει ο συγχρονισμός."
- **Accept:** Editing a favorite updates the server; deleting it removes it on next sync; adding an 11th favorite blocks locally with the cap sheet.

---

## Phase D — Today feature (T16–T18)

### T16. Easter computation
- `mobile/features/today/namedays/easter.ts`: `orthodoxPascha(year: number): Date` using Meeus's algorithm. Pure function, no deps beyond `date-fns` for date construction.
- Helper: `resolveEasterOffsetCelebrations(year)` → for moveable-feast catalog entries, compute their Gregorian dates for the given year, cached in a module-level `Map<year, Map<nameday_key, Date>>`.
- **Accept:** Unit-style test in a throwaway screen: `orthodoxPascha(2026)` returns `2026-04-12` (Orthodox Easter 2026).

### T17. useTodayList hook
- `mobile/features/today/hooks/useTodayList.ts`: takes `today: Date`, returns `{today: TodayItem[], upcoming: TodayItem[], loading}`. Reads live favorites; for each, resolves the next celebration date (fixed → next occurrence of MM-DD; easter_offset → Easter+offset for current year, or next year if past); also resolves birth dates. Splits into today vs upcoming 7 days. Upcoming sorted by date, capped at 10.
- **Accept:** With a favorite "Γιώργος" (nameday_key=georgios) and today's date = 2026-04-23 → appears in `today`; with today=2026-04-22 → appears in `upcoming`.

### T18. Today screen
- `mobile/features/today/screens/TodayScreen.tsx`: `SectionList` with two sections per spec §8.1. Header text "Σήμερα, <DayName> <DD/MM>" + saint of the day from the catalog (if any).
- `mobile/features/today/components/CelebratingCard.tsx`: row UI for both sections.
- Wire `mobile/app/(tabs)/index.tsx` to render `TodayScreen`.
- Empty state per spec.
- **Accept:** On a date matching a stub catalog entry that also matches a favorite, the favorite appears under "Γιορτάζουν σήμερα". With no favorites celebrating today, the empty state shows; upcoming events still appear if any.

---

## Phase E — Settings + auth stubs (T19–T20)

### T19. Settings screen
- `mobile/features/settings/screens/SettingsScreen.tsx`: three sections per spec §8.5 (Account, Sync, About).
- Account shows "Συνδεδεμένος ανώνυμα" + buttons `Σύνδεση` / `Δημιουργία λογαριασμού` routing to the stubs (T20).
- Sync shows `lastSyncedAt` formatted in Greek + `pendingCount` + manual `Συγχρονισμός τώρα` button (calls `syncNow()`).
- About shows app version from `expo-application` + build channel from `expo-constants`.
- Wire `mobile/app/(tabs)/settings.tsx`.
- **Accept:** All three sections render; manual sync button works (verified by `lastSyncedAt` updating).

### T20. Auth stubs
- `mobile/app/auth/sign-in.tsx` and `mobile/app/auth/register.tsx`: each renders a centered `<EmptyState title="Σύντομα κοντά σας" message="Θα προστεθεί στη Φάση 4." />` with a back button in the header.
- Add these as a non-tab `Stack` in `app/_layout.tsx`.
- **Accept:** Both screens reachable from Settings, header back works.

---

## Phase F — Wrap (T21–T23)

### T21. Bottom tab navigation
- `mobile/app/(tabs)/_layout.tsx`: three tabs — Today (icon: `calendar`), Favorites (`heart`), Settings (`settings`). Labels in Greek. Use `@expo/vector-icons` (Ionicons).
- Active/inactive tints per a tiny theme constant in `lib/ui/theme.ts` (Plan 6 introduces a real theme).
- **Accept:** Tabs render at bottom, switching between them works without unmounting state.

### T22. UI primitives + states
- `mobile/lib/ui/`: `Button`, `ScreenContainer`, `EmptyState`, `BootingScreen`, `Banner` components. Greek-locale-aware where relevant.
- Audit every screen: confirm loading and empty states are wired (no raw "undefined" or blank screens during async).
- **Accept:** Every screen has a loading state and an empty state; no flicker on cold start.

### T23. Final dev build + success criteria checklist
- Bump version in `app.json` if any native deps changed; otherwise stay on the existing dev client.
- For JS-only changes: `eas update --branch development --message "Plan 3 MVP"`. For native changes: rebuild with `eas build --profile development --platform android`.
- Walk through every bullet in spec §15 on a real device. Capture screenshots into `docs/screenshots/plan-3/`.
- **Accept:** All six success-criteria bullets verified. Plan 3 is done.

---

## Pre-flight checklist before starting T1

- [ ] Run `git status` — clean tree on `feature/plan-3-mobile-mvp`.
- [ ] Backend smoke-tested live: `curl https://celebrations-api.onrender.com/api/health` → 200.
- [ ] Phone is on the same network as dev machine (or use tunneled Expo Dev Server) for the first dev-client run.
- [ ] Expo CLI logged in (`eas whoami` returns `dimkaratz`).
- [ ] No outstanding TODO in `appsettings.json` or `eas.json`.

## Conventions

- **Imports**: use `@/lib/...` and `@/features/...` path aliases.
- **State**: local component state by default. Context only for cross-cutting (auth, sync). No global stores in Plan 3.
- **Strings**: hardcoded Greek for now; extract to a `lib/i18n/` module in Plan 4.
- **Tests**: no formal tests in Plan 3 except spec §15 manual checks. Plan 4 introduces Vitest + a render smoke test per screen.
- **Commits**: one per task, message format `feat(plan-3,TN): <short summary>` (T1, T2, ...). Per memory: no `Co-Authored-By` trailer.
- **Branch**: everything on `feature/plan-3-mobile-mvp`. PR opens after T23 with all 23 commits.
