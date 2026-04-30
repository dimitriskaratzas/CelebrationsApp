# Celebrations — Design Specification

**Date:** 2026-04-30
**Status:** Approved design, ready for implementation planning
**Replaces:** `NAMEDAY_SPEC.md` (initial draft)

---

## 1. Product Vision & Positioning

A polished mobile app (iOS + Android) for tracking and being reminded of important celebrations — namedays and birthdays — for the people you care about. Targeted at the Greek market with diaspora as a meaningful secondary audience.

The original spec was titled *Ονομαστική* and treated namedays as the only feature. This spec rebrands the product as **Celebrations** to honestly reflect the dual-purpose data model (namedays + birthdays) shipping at launch, while keeping namedays as the primary marketing positioning.

### Marketing positioning (launch narrative)

Headline pitch: *"Επιτέλους η ελληνική app για ονομαστικές & γενέθλια — με σωστές υπενθυμίσεις, modern σχεδίαση, και τα δεδομένα σου να μην χάνονται όταν αλλάξεις κινητό."*

Birthdays are positioned as a confident *"και τα γενέθλια"* — a complete app, not a co-headline. Greek nameday angle stays sharp for press, App Store discovery, and word-of-mouth.

### Differentiators (none of which require AI)

1. Modern, "Modern Greek warmth" visual design — clean, contemporary, restrained Greek-typographic flourishes. Stands out in a market of dated nameday apps.
2. Correctly-computed Orthodox movable feasts (Πάσχα-relative dates) — most existing apps get these wrong.
3. Greeklish-aware search and matching (Giorgos → Γιώργος).
4. Privacy-first: address book never leaves the device; only user-curated favorites sync to the backend.
5. Cross-device sync via email/password authentication; data persists across phone changes.
6. Birthdays from day 1 alongside namedays — competitors specialize in one or the other.
7. Diaspora-friendly: i18n-ready architecture, anonymous-default UX, works in low-connectivity scenarios.

---

## 2. Locked Decisions Summary

These decisions are the load-bearing constraints for the design. They were each chosen deliberately during brainstorming and should not be revisited without explicit re-evaluation.

| # | Decision |
|---|---|
| 1 | **Launch goal:** polished v1, ~12–14 week timeline. Diaspora is a secondary but real audience. |
| 2 | **UI language:** Greek-only at launch; codebase is i18n-ready (no hardcoded strings) so EN can be added later without rewriting. |
| 3 | **Freemium model:** **favorite cap on free tier (15 favorites), unlimited on premium**. AI features are NOT in v1. |
| 4 | **Pricing:** 1.99€/mo, 9.99€/yr, 19.99€ lifetime, via Adapty. App Store / Play Store auto-localized pricing tiers. |
| 5 | **Scope:** namedays + birthdays both ship in v1, with "celebrations" as the unifying internal abstraction. |
| 6 | **Identity:** anonymous-default user with email/password registration. Sign in with Apple / Google deferred to Phase 1.1. |
| 7 | **Data residency:** raw contacts never leave device; favorites (minimal payload) sync to backend; data minimization is a guiding principle. |
| 8 | **Visual direction:** "Modern Greek warmth" — clean, contemporary, warm off-whites + deep blue + gold accents, restrained Greek-typographic flourishes. |
| 9 | **AI ευχές:** **deferred to Phase 2.** v1 ships with hand-written preset wishes per relationship (~50 total). |
| 10 | **Backend stack:** ASP.NET Core .NET 9, Clean Architecture, Controllers (not Minimal API), manual SQL schema (no EF migrations), PostgreSQL — matching PregnancyApp conventions exactly. |
| 11 | **Mobile stack:** Expo + Expo Router, TypeScript, SQLite (`expo-sqlite`), Context+hooks for UI state (no Zustand), `expo-notifications` for local notifications, `react-native-reanimated` for animation. |
| 12 | **Subscriptions:** Adapty SDK on mobile, behind an `IPurchasesService` abstraction. Standalone entitlements microservice deferred to backlog (when 2nd app needs it). |
| 13 | **Observability v1:** Sentry free tier for both mobile + backend errors; Render's built-in monitoring for backend metrics; custom analytics events written to Postgres, queried with SQL. Self-hosted Prom + Grafana + Loki deferred to backlog. |
| 14 | **Logging:** default `Microsoft.Extensions.Logging.ILogger`, matching PregnancyApp's pattern. |

---

## 3. System Architecture Overview

```
┌──────────────────────────────────────────┐
│  Mobile app (iOS + Android)              │
│  Expo / Expo Router / TypeScript         │
│                                          │
│  Screens (Today, Calendar, Contacts,     │
│           Wish, Settings, Auth)          │
│  Context+hooks state (UI only)           │
│  Services (contacts, sync, purchases,    │
│            notifications, crash)         │
│  SQLite — offline-first cache + favorites│
│  Adapty SDK — subscription state         │
│  Sentry SDK — crash + error reporting    │
└─────────────┬────────────────────────────┘
              │ HTTPS (JWT auth)
              ▼
┌──────────────────────────────────────────┐
│  Backend — ASP.NET Core (.NET 9)         │
│  Clean Architecture                      │
│  Hosted on Render                        │
│                                          │
│  Controllers:                            │
│   • AuthController                       │
│   • FavoritesController                  │
│   • AnalyticsController                  │
│   • WebhooksController                   │
│  Postgres (manual schema):               │
│   • users                                │
│   • favorites                            │
│   • subscription_entitlements            │
│   • analytics_events                     │
└─────────────┬────────────────────────────┘
              │
              ├─→ Adapty (subscription validation)
              └─→ Sentry SaaS (error capture)
```

### Architectural principles

- **Local-first UX, server-aware truth.** App opens instantly using SQLite cache. Server is source of truth for favorites sync, premium entitlement.
- **Celebrations as a uniform abstraction.** Namedays and birthdays differ only in date-resolution rules. Same data flow, same UI components.
- **The phone never sends the user's address book.** Contact matching is local; only explicit favorites sync.
- **Data minimization on backend.** Backend stores the minimum needed for sync, identification, and recovery. Rich detail (notes, sent history, settings) stays on device.
- **Pattern parity with PregnancyApp.** Same Clean Architecture, same auth pattern, same logging, same React Native conventions.

---

## 4. Mobile Architecture

### Folder structure

```
mobile/
├── app/                              # Expo Router (file-based)
│   ├── (tabs)/
│   │   ├── today.tsx
│   │   ├── calendar.tsx
│   │   ├── contacts.tsx
│   │   └── settings.tsx
│   ├── wish/[id].tsx                 # Preset wish picker + share
│   ├── auth/                         # Login, register, forgot-password, reset
│   └── onboarding/                   # First-run flow
├── src/
│   ├── features/                     # Feature-folder organization
│   │   ├── celebrations/             # Today/Calendar logic + components
│   │   ├── favorites/                # CRUD + sync
│   │   ├── contacts/                 # Local matching, never uploaded
│   │   ├── wishes/                   # Preset wish picker (Phase 2: AI)
│   │   ├── notifications/            # Local scheduling
│   │   ├── premium/                  # Adapty wrapper, favorite-cap state
│   │   ├── auth/                     # AuthContext, login/register flows
│   │   └── settings/
│   ├── data/                         # Static, bundled with app
│   │   ├── namedays.json             # Greek nameday calendar
│   │   ├── wishes-presets.json       # Hand-written ευχές per relationship
│   │   └── greeklish-map.ts
│   ├── db/                           # SQLite layer
│   │   ├── schema.ts
│   │   ├── migrations.ts
│   │   └── repositories/
│   ├── services/
│   │   ├── api.ts                    # Axios client, JWT, retries
│   │   ├── sync.ts                   # Favorites server↔local reconciliation
│   │   ├── purchases.ts              # IPurchasesService → Adapty impl
│   │   └── crash.ts                  # Sentry init
│   ├── state/                        # Context+hooks stores
│   │   ├── AuthContext.tsx
│   │   ├── PremiumContext.tsx
│   │   ├── TodayContext.tsx
│   │   └── SettingsContext.tsx
│   ├── ui/
│   │   ├── theme.ts                  # Modern Greek warmth tokens
│   │   ├── components/
│   │   └── icons/
│   └── utils/
│       ├── movable-feasts.ts         # Orthodox Easter computus + offsets
│       ├── greeklish.ts
│       └── dates.ts
```

### Key choices

- **Feature-folder organization** scales better than strict layered for a multi-feature app.
- **SQLite as offline-first cache; server-authoritative for syncable data.**
  - Favorites: server authoritative, SQLite mirrors. Optimistic local writes + background push.
  - Sent history, settings, notification schedule: SQLite-only.
- **Context+hooks for UI state**, matching PregnancyApp. Four stores: Auth, Premium, Today, Settings.
- **Service layer is thin and abstraction-friendly.** `IPurchasesService` abstracts Adapty (swappable later). `api.ts` is a single axios instance with JWT auth interceptor.
- **Static data bundles with the app.** `namedays.json` and `wishes-presets.json` ship in the binary. Updates via `expo-updates` (OTA).

### Out of scope at this layer

- Hand-rolled animation library (use `react-native-reanimated`).
- CSS-in-JS or NativeWind (use React Native `StyleSheet` + `theme.ts` tokens).

### Decided during implementation

- Greeklish library choice (hand-rolled mapping vs npm package) — evaluate against actual edge cases.
- Date library (`date-fns` vs native `Intl`) — small choice, defer.
- SQLite migration version-numbering scheme — standard pattern, defer.

---

## 5. Backend Architecture

### Project structure (matches PregnancyApp)

```
backend/
├── Celebrations.Domain/              # Entities, value objects, business rules
│   └── Entities/
│       ├── User.cs
│       ├── Favorite.cs
│       ├── SubscriptionEntitlement.cs
│       └── AnalyticsEvent.cs
├── Celebrations.Application/
│   ├── Common/Interfaces/
│   │   ├── IUserRepository.cs
│   │   ├── IFavoriteRepository.cs
│   │   ├── IEntitlementRepository.cs
│   │   ├── IAnalyticsRepository.cs
│   │   ├── IAuthService.cs
│   │   ├── IJwtTokenService.cs
│   │   ├── ICurrentUser.cs
│   │   └── IPurchaseValidator.cs     # Abstracts Adapty
│   ├── DTOs/
│   └── Services/
├── Celebrations.Infrastructure/
│   ├── Persistence/
│   │   ├── AppDbContext.cs           # EF Core, NO migrations
│   │   └── Repositories/
│   ├── External/
│   │   └── AdaptyClient.cs
│   └── DependencyInjection.cs
└── Celebrations.API/
    ├── Controllers/
    │   ├── AuthController.cs
    │   ├── FavoritesController.cs
    │   ├── AnalyticsController.cs
    │   └── WebhooksController.cs
    ├── Middleware/
    │   ├── JwtAuthMiddleware.cs
    │   └── RateLimitMiddleware.cs
    ├── Program.cs
    └── appsettings.json
database/
└── create_tables.sql                 # Manual schema, like PregnancyApp
```

### Endpoint groups

**`/api/auth`** — Authentication
- `POST /register` — email + password registration; claims an existing anonymous user record if present
- `POST /login` — email + password authentication
- `POST /refresh` — refresh JWT
- `POST /logout` — revoke refresh token
- `POST /forgot-password` — initiate reset flow (email-based)
- `POST /reset-password` — complete reset flow with token
- `POST /anonymous` — create anonymous user on first launch (no UI involved); returns JWT
- All flows mirror PregnancyApp's `IAuthService`/`AuthController` patterns

**`/api/favorites`** — Sync (CRUD)
- `GET /favorites?since=<timestamp>` — incremental sync; returns favorites changed since timestamp
- `POST /favorites` — create (enforces favorite-cap on free tier)
- `PUT /favorites/{id}` — update
- `DELETE /favorites/{id}` — soft delete (tombstone via `deleted_at` for sync visibility on other devices)
- All scoped by authenticated `userId`

**`/api/analytics`** — Event ingest
- `POST /events` — accepts batched events `[{name, props, timestamp}]`
- Writes to `analytics_events` table indexed for time-range queries

**`/api/webhooks/adapty`** — Subscription lifecycle
- Adapty webhook signature validation
- Updates `subscription_entitlements` on purchase, renewal, cancellation, refund

### Database tables (high-level)

Minimal columns shown — full schema lives in `database/create_tables.sql`.

- `users` — `id, email, password_hash, anonymous_until_signup, created_at, last_seen_at`
- `favorites` — `id, user_id, display_name, name_day_key, birthday_date, relationship, custom_overrides, created_at, updated_at, deleted_at`
- `subscription_entitlements` — `user_id, product_id, status, expires_at, original_purchase_date`
- `analytics_events` — `id, app_id, user_id (nullable), event_name, props_jsonb, created_at` indexed `(app_id, event_name, created_at)`

### Cost & abuse guards

- **Favorite-cap enforced server-side** at `POST /favorites` — free tier rejected at 16th favorite with 402 Payment Required.
- **Per-user rate limit middleware** — 60 req/min across endpoints.
- **Per-IP rate limit middleware** — additional layer.
- **JWT expiry** — short-lived access tokens (15 min), longer refresh tokens (30 days).
- **Email/password security** — bcrypt or Argon2id for password hashing (match PregnancyApp's existing pattern).

### Configuration & secrets

- Database connection string, Adapty webhook secret, JWT signing key → environment variables (never committed).
- `appsettings.json` for non-secrets (rate limit values, free-tier favorite cap).

### Logging

- Default `Microsoft.Extensions.Logging.ILogger` to console; Render captures and surfaces in its log viewer.
- Structured logging via placeholder syntax: `logger.LogInformation("Favorite created for {UserId}", userId)`.

### Error capture

- Sentry SDK (`Sentry.AspNetCore`) — one-line setup. Captures exceptions with breadcrumb context.

---

## 6. Data Flow & Sync Model

### Privacy-critical flow: adding a favorite from a contact

1. User taps a contact in Contacts tab.
2. Mobile reads contact via `expo-contacts` — only `displayName` and optional `birthday` field. Phone, email, address, photo are **not read**.
3. Greeklish normalization: `"Giorgos Papadopoulos"` → `"Γιώργος"`.
4. Match against bundled `namedays.json` → `Γιώργος` celebrates 23/04.
5. User confirms relationship and saves.
6. SQLite insert with `sync_status='pending'`. UI updates immediately.
7. Background `POST /favorites` with minimal payload: `{ displayName, nameDayKey, birthday, relationship }`.
8. Server returns canonical record + ID. Local row updated to `sync_status='synced'`.

**What never crosses the wire:** phone numbers, emails, address book IDs, the user's contact list, anything beyond the explicit favorite the user confirmed.

### Sending a wish (v1, no AI)

1. User taps a favorite → action sheet → "Στείλε ευχή".
2. Wish screen shows 5–8 preset Greek ευχές for the relationship from `wishes-presets.json` (static, bundled).
3. User picks one, can edit inline.
4. Tap "Στείλε" → opens system share sheet with wish text + recipient name pre-filled. Defaults to WhatsApp if installed.
5. Local-only `sent_history` row written. Backend never learns whom the user sent to.

### Cross-device sync

- New phone → install app → register/sign in → backend resolves user → `GET /favorites?since=0` pulls full state → SQLite populated → app fully usable.
- Anonymous-default users who never signed in: data is local-only (with iCloud/Google auto-backup as a fallback for SQLite file). Re-prompted to sign in at strategic moments.

### Conflict model (Phase 1)

- Single device per user in v1 (since cross-device requires sign-in, which is anonymous-only by default).
- Future-proofed: `updated_at` timestamps on all favorite fields, last-write-wins semantics, soft deletes via tombstones for cross-device visibility.

### What stays only on device

- Sent history (privacy — backend never knows whom you sent to).
- Settings (notification time, days-before, etc.).
- The user's address book (read for matching only, never stored or transmitted).
- Notes / custom overrides (data minimization).

### What's on the backend

- Favorites — minimum sync payload (display name, dates, relationship, custom date overrides).
- Subscription entitlements (per user, with Adapty as upstream truth).
- Analytics events (anonymous-by-design, behavioral).
- Users (email, password hash, account state).

---

## 7. Notifications Model

### Goals

1. **Heads-up reminder**: 3 days before a celebration.
2. **Day-of nudge**: morning of a celebration at configurable time, default 09:00.
3. **Digest** for multi-celebration days: one notification listing all (default on).

### Architecture

- **Local notifications only** via `expo-notifications`. No push. No backend involvement.
- **OS-scheduled**: app tells the OS ahead of time "show this notification at this date/time"; app does not need to be running when it fires.
- **Free at any scale** — no Anthropic-style per-call cost.

### Smart scheduling strategy (handles iOS 64-cap)

- **Day-of notifications**: scheduled for the **full year** upfront, **one slot per unique celebration day** (digest covers everyone celebrating that day). Bedrock reliability — survives long inactivity gaps.
- **3-days-before notifications**: scheduled for a **rolling 60-day window**, refreshed on app open. Soft reminder; degrades gracefully if app isn't opened.
- **Re-schedule triggers**: app open, favorite create/edit/delete, settings change, monthly background refresh.

### Permission UX

- **Don't prompt on first launch** — declined-by-default if asked too early.
- **Prompt at first natural moment**: when user adds their first favorite, with explanatory bottom sheet.
- **Decline fallback**: app still works; yellow banner in Settings explaining.

### Customization (Settings)

- Notification time (default 09:00, range 07:00–12:00).
- Days-before (default 3; options: 1, 3, 7).
- Digest toggle (default on).
- Per-favorite VIP override (Phase 1.5).

### Movable feasts (Greek-specific)

Pure-function `orthodoxEaster(year)` using known computus formula (~10 lines). `movableFeasts(year)` lookup with Easter-relative offsets (Λάζαρος = Easter-8, Πεντηκοστή = Easter+49, etc.). Saint-specific override rules (e.g. Άγιος Γεώργιος moved if in Holy Week) in a small hardcoded table. Verified against known Orthodox Easter dates 2024–2030 in unit tests.

### Out of scope for v1

- Snooze / "remind me again".
- Custom notification sounds.
- Per-favorite custom notification text.

---

## 8. Premium Tier (favorite-cap freemium)

### Free tier

- Up to **15 favorites**.
- All other features included: calendar, reminders, contacts sync, share via WhatsApp/Viber/SMS, preset wishes, movable feasts, etc.

15 was chosen to comfortably fit a typical Greek family (parents + grandparents + 3–5 siblings + spouse + 4–5 close friends ≈ 12–14) while creating real upgrade pressure for users with extended families. Adjustable based on conversion data after launch — erring slightly generous because ratcheting down feels like betrayal, ratcheting up feels like a giveaway.

### Premium tier

**Pricing**: 1.99€/mo, 9.99€/yr, 19.99€ lifetime (auto-localized via App Store / Play Store pricing tiers).

**Includes**:
- Unlimited favorites.
- Marketing line: *"Ξεκλείδωσε απεριόριστα αγαπημένα — και απόκτησε πρόσβαση σε όλα τα Premium χαρακτηριστικά που έρχονται"*.
- Phase 2 expansion: when AI ευχές ship, premium users get them automatically (Sonnet 4.6, 3 alternatives, all tones including Funny, edit, regenerate). This is a real reward for early conversion.

### Enforcement

- **Server-side at `POST /favorites`** — request rejected with 402 Payment Required when free user attempts to create the 16th favorite.
- **Client shows paywall** on the rejection, with current count and upgrade options.
- **Subscription state** synced from Adapty webhook → `subscription_entitlements` table → JWT claims → API authorization.

---

## 9. Phase 2 Design Reference: AI ευχές

Preserved here for Phase 2 implementation. Not part of v1 build.

### Tier routing (for future implementation)

- **Free tier**: Haiku 4.5, 1 alternative, Casual + Formal tones only. ~10 wishes/month.
- **Premium tier**: Sonnet 4.6, 3 alternatives, all 4 tones (incl. Funny), inline edit, regenerate freely. Soft 30/month abuse cap.

### Cost projections (~$0.0009/Haiku call, ~$0.0072/Sonnet call with prompt caching)

| Scale | Estimated Anthropic spend |
|---|---|
| 1,000 MAU, 5% premium | ~$13/mo |
| 10,000 MAU, 5% premium | ~$124/mo |
| 100,000 MAU, 5% premium | ~$1,240/mo (vs ~$10,000/mo premium revenue) |

Hard monthly spend caps in Anthropic Console + per-user rate limits + daily ceiling alarms make runaway impossible.

### Prompt strategy

Server-assembled, never client-controlled (prevents prompt injection). Two distinct system prompts (nameday vs birthday). User message scaffold takes recipient name (κλητική), relationship, tone, sender name, occasion. Native-speaker review pass before Phase 2 launch is a hard requirement.

Full prompt design preserved in conversation transcript and to be re-loaded when Phase 2 is planned.

---

## 10. Open Items Requiring Resolution Before Launch

These don't change the architecture but need decisions or content during the build:

| Item | Recommendation |
|---|---|
| Greek nameday calendar data source | Build manually from authoritative church sources, ~1500–2000 names, native-speaker review pass. ~1 week of work. |
| App Store / Play Store launch market sequencing | Greece + Cyprus simultaneously at v1; light marketing translation for diaspora markets 2–4 weeks later. |
| Beta testing channel & cohort | TestFlight + Play Internal Testing, ~30 testers (10 close friends, 10 random Greek users, 10 diaspora), 4–6 weeks before public launch. Free Premium for testers. |
| Pricing currency for diaspora | Use Apple/Google auto-localized pricing tiers (Apple Tier 2 = $1.99 / 1.99€ / £1.99 etc.). |
| 50 preset wishes content | Written by fluent Greek speaker; ~7 relationships × 5–8 wishes each. ~1 week of writing + review. |
| App icon, splash, store screenshots | Designer or in-house, using "Modern Greek warmth" tokens. ~1 week budget. |

---

## 11. Launch Operational Checklist

### Backend & infrastructure

- [ ] Render account + service deployed, custom domain.
- [ ] Postgres provisioned with manual schema (`database/create_tables.sql`).
- [ ] Adapty account + Apple/Google billing products configured + webhook endpoint live.
- [ ] Sentry projects (mobile + backend).
- [ ] Environment variables / secrets configured in Render (no secrets in repo).
- [ ] Database backup schedule enabled (Render daily snapshots).

### Mobile / App Store

- [ ] EAS Build configured for iOS + Android.
- [ ] iOS Apple Developer account (€99/year), App ID, distribution provisioning.
- [ ] Google Play Developer account ($25 one-time), app listing.
- [ ] App icon + splash + store screenshots (6.7" / 6.5" / 5.5" formats).
- [ ] Privacy policy URL (live page) — required for both stores.
- [ ] Terms of Service URL — required for in-app purchases.
- [ ] Store listing copy: Greek + English (for diaspora markets).
- [ ] Beta testing complete; critical bugs fixed.

### Content

- [ ] `namedays.json` complete, native-speaker reviewed.
- [ ] `wishes-presets.json` (50+ presets) written and reviewed.
- [ ] Onboarding copy reviewed by native speaker.
- [ ] Notification copy reviewed by native speaker (consistent voice with app).

### Legal / compliance

- [ ] GDPR-compliant privacy policy explicitly stating: contacts stay on device, what data is on backend, how to delete account.
- [ ] Apple App Privacy questionnaire filled accurately.
- [ ] Google Play Data Safety form filled accurately.
- [ ] Adapty receipt validation tested with real test purchases on both platforms.

### Quality gates

- [ ] Tested on iOS (latest + 1 prior major version).
- [ ] Tested on Android (latest + 1 prior major version, including one Xiaomi/Huawei device for notification reliability).
- [ ] Movable feast dates validated for 2026, 2027, 2028 against published Orthodox Easter dates in unit tests.
- [ ] Sync edge cases: same user signing in on a 2nd device, signing out, deleting account.
- [ ] Notification permission flows tested across iOS/Android variants.
- [ ] Free→Premium upgrade flow tested with real test purchase on both platforms.

---

## 12. Risks and Mitigations

| Risk | Likelihood | Mitigation |
|---|---|---|
| Greek nameday data has errors that erode trust | Medium | Native-speaker review pass; first-week feedback channel ("report incorrect date" in-app). |
| Notifications fire on wrong day for movable feasts | Low (if computus is correct) | Unit tests against known Orthodox Easter dates 2026–2030. |
| Adapty integration has edge cases (refunds, family sharing, lapsed subs) | Medium | Test with real test purchases on both platforms before launch; subscribe to Adapty webhook for all event types. |
| App Store rejects on first submission | Common (~40% industry norm) | Build 2-week buffer into launch timeline; common rejections: missing privacy policy, in-app purchase localization, screenshot quality. |
| Backend goes down at launch under unexpected load | Low | Render auto-scales; Postgres handles 10k+ DAU comfortably. |
| Conversion rate is much lower than projected (favorite-cap is too generous) | Medium | Monitor for first 60 days; if too low, lower the cap (with caveat that ratcheting down is unpopular). |
| User loses data on phone change without signing in | Mitigated | Anonymous-default + strategic re-prompts to sign in; iCloud/Google auto-backup of SQLite as fallback for SQLite file when in standard directory. |

---

## 13. Roadmap

| Phase | Focus | Timeline (approx) |
|---|---|---|
| **v1 launch** | Calendar + favorites + birthdays + reminders + email/password auth + sync + share + preset wishes | 12–14 weeks from start |
| **Phase 1.1** | Sign in with Apple / Google added; per-favorite custom reminder timing | 3–6 weeks post-launch |
| **Phase 2** | AI ευχές (Sonnet/Haiku tiering, premium gate, native-speaker review). Premium expands to include AI features for existing premium users automatically. | 3–6 months post-launch |
| **Phase 3** | iOS/Android home-screen widgets, saint imagery, snooze/custom sounds, social-light features (e.g. shared family calendars) | 6–9 months post-launch |
| **Phase 4** | Standalone entitlements microservice (when PregnancyApp goes live with premium); shared observability infra (Prom + Grafana + Loki); export/import file improvements | When justified by 2nd app reaching premium |

---

## Appendix A: Backlogged decisions (carried forward)

These were considered during brainstorming and explicitly deferred:

- **Cloud backup with auth-driven sync (B in identity discussion)** — folded into v1 via email/password auth, no longer a separate phase.
- **Pure-SaaS observability (Sentry + PostHog + Render only)** — kept as escape hatch if self-host ops becomes painful in Phase 4.
- **Standalone entitlements microservice** — extract from monolith when 2nd app goes premium.
- **Self-hosted Prom + Grafana + Loki stack** — defer to Phase 4 / shared platform infra moment.
- **Sign in with Apple / Google** — Phase 1.1 fast-follow.
- **AI ευχές** — Phase 2.
- **iOS/Android widgets** — Phase 3.
- **Per-favorite custom reminders** — Phase 1.5 / 1.1.

## Appendix B: Reference to PregnancyApp conventions inherited

For readers of this spec who haven't worked in the sister project, Celebrations inherits these conventions wholesale from `PregnancyApp/CLAUDE.md`:

- **Clean Architecture**: Domain ← Application ← Infrastructure ← API. Dependencies flow inward.
- **No EF Core migrations**: schema lives in `database/create_tables.sql`. `AppDbContext` is for queries only.
- **C# 12** features (primary constructors, collection expressions).
- **Nullable reference types** enabled.
- **Controllers** with primary constructor injection, returning `ActionResult<T>`.
- **API URL pattern**: `GET/POST/PUT/DELETE /api/{resource}/{id}`.
- **Greek error messages** in 400 Bad Request responses.
- **Static content as JSON files** loaded by singleton services (analog to `WeekContentService`).

---

*End of spec.*
