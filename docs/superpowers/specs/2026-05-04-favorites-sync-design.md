# Plan 2 — Favorites Sync (Backend) Design

**Date:** 2026-05-04
**Status:** Approved design, ready for implementation planning
**Builds on:** `2026-04-30-celebrations-design.md` (master spec), Plan 1 backend foundations (auth, users, refresh tokens, password reset)

---

## 1. Goal

Add server-side favorites storage and incremental cross-device sync to the Celebrations backend. After Plan 2, the mobile app can:

- Create, read, update, and soft-delete favorites scoped to the authenticated user.
- Pull only what changed since its last sync via `GET /api/favorites?since=<timestamp>`.
- See free-tier favorites caps enforced server-side, with the cap value tunable via configuration.
- Use the same code path whether the user is anonymous or registered (cap, auth, and scoping are uniform).

Adapty webhook integration and the `subscription_entitlements` table are explicitly out of scope; they will be a later plan. Plan 2 ships with a stub `IEntitlementRepository` that always returns "free."

## 2. Locked Decisions

These were settled during brainstorming and are load-bearing for the implementation plan.

| # | Decision | Rationale |
|---|---|---|
| 1 | Plan 2 scope = favorites only; entitlement check is a stub. | Keeps Plan 2 focused. Defines the right interface so Adapty plan can drop in a real implementation without controller changes. |
| 2 | Anonymous users CAN sync favorites (uniform with registered). | Single code path, simple claim flow (userId preserved from Plan 1), cap enforced once. Privacy delta is small (no PII in the data we store). |
| 3 | `nameDayKey` format = ASCII slug (e.g. `"giorgos"`). | URL-safe, Greeklish-friendly, easy to compare, lower-case canonical. |
| 4 | `customOverrides` field is dropped from this plan. | YAGNI; conflicts with the spec's data-minimization principle. Add later only if a concrete use case appears. |
| 5 | `relationship` is a constrained enum, not free text. | Wish-presets bundle is keyed by relationship; free text causes client drift, poisons data, and breaks Phase 2 AI ευχές routing. Adding a new relationship requires a coordinated mobile/backend release anyway. |
| 6 | Client-generated UUIDs on `POST`. | Offline-first friendly: SQLite row never has its primary key rewritten. Server validates uniqueness. |
| 7 | `PUT` does full replacement, not partial. | Payload is small (~250 bytes/favorite); full-replace is simpler to implement and reason about. |
| 8 | Sync response shape = single round-trip with `favorites[]` + `deletions[]` + `syncedAt`. | One HTTP call, one cursor, tombstones are just IDs. Matches Firestore/Linear sync shape. |
| 9 | Free-tier favorites cap = **10**, configurable via `Premium:FreeFavoritesCap`. | Spec calls for "ratchet up, never down"; starting at 10 leaves room to raise post-launch if conversion data warrants. |
| 10 | Soft-delete via `DeletedAt` tombstone, never hard-deleted by the API. | Required for cross-device sync visibility (other devices need to know about deletions). |

## 3. Architecture

Plan 2 follows the Clean Architecture pattern established in Plan 1: dependencies flow inward from API → Infrastructure → Application → Domain.

### File layout (new files only)

```
backend/
├── Domain/Entities/
│   └── Favorite.cs                                    ← aggregate, factory + business rules
├── Application/
│   ├── Common/Interfaces/
│   │   ├── IFavoriteRepository.cs                     ← repository contract
│   │   └── IEntitlementRepository.cs                  ← premium check abstraction
│   ├── DTOs/
│   │   └── FavoriteDtos.cs                            ← request + response shapes
│   └── Mapping/
│       └── FavoriteMapping.cs                         ← entity ↔ DTO
├── Infrastructure/
│   ├── Persistence/Configurations/
│   │   └── FavoriteConfiguration.cs                   ← EF fluent config
│   └── Repositories/
│       ├── FavoriteRepository.cs                      ← EF implementation
│       └── StubEntitlementRepository.cs               ← always returns false
├── Api/Controllers/
│   └── FavoritesController.cs                         ← four endpoints
└── Tests/Favorites/
    ├── FavoriteRepositoryTests.cs                     ← scope safety, sync filters
    ├── FavoritesControllerTests.cs                    ← endpoint behavior
    └── EntitlementCapTests.cs                         ← cap enforcement edge cases
```

Edits to existing files:

- `Infrastructure/Persistence/AppDbContext.cs` — add `DbSet<Favorite> Favorites` and apply `FavoriteConfiguration`.
- `Infrastructure/DependencyInjection.cs` — register `IFavoriteRepository` and `IEntitlementRepository` (scoped).
- `Api/appsettings.json` — add `Premium:FreeFavoritesCap = 10`.
- `database/create_tables.sql` — append `Favorites` table + indexes.
- `backend/README.md` — add `/api/favorites` endpoint group.

### Pattern parity with Plan 1

- Primary-constructor injection in controllers and services (C# 12).
- `Result<T>` from `AuthService` is the model; this plan uses controller-level error mapping rather than a dedicated `IFavoritesService` because the logic is thin (cap check + repository call). If the controller exceeds ~150 lines, extract into a service.
- All entities derive from `BaseEntity` (gives `CreatedAt`/`UpdatedAt`).
- Entity configurations use the EF fluent API; no migrations.
- Greek error messages on user-facing 4xx responses, matching Plan 1's `AuthController` style.

## 4. Data Model

### `Favorite` entity (Domain)

| Field | Type | Notes |
|---|---|---|
| `Id` | `Guid` | Client-generated UUID v4. Validated for uniqueness (cross-user collision → 409). |
| `UserId` | `Guid` | FK to `Users.Id`. All queries scoped by this. |
| `DisplayName` | `string` | Required. Trimmed. Max 100 chars. |
| `NameDayKey` | `string?` | ASCII slug, max 64 chars. Lowercased on set. Nullable (no nameday for this person). |
| `BirthdayDate` | `DateOnly?` | Nullable; not everyone shares their birthday. |
| `Relationship` | `string?` | Constrained enum; see §4.1. Nullable. Stored lowercase. |
| `CreatedAt` | `DateTime` | UTC, set on insert. (From `BaseEntity`.) |
| `UpdatedAt` | `DateTime?` | UTC, bumped on every `Update` and on `SoftDelete`. |
| `DeletedAt` | `DateTime?` | UTC tombstone marker. Null = live. |

#### Factory and methods

```csharp
public static Result<Favorite> Create(
    Guid id,
    Guid userId,
    string displayName,
    string? nameDayKey,
    DateOnly? birthdayDate,
    string? relationship);

public Result Update(
    string displayName,
    string? nameDayKey,
    DateOnly? birthdayDate,
    string? relationship);

public void SoftDelete();   // sets DeletedAt and UpdatedAt
```

`Create` and `Update` validate: display name non-empty after trim, lengths within bounds, `nameDayKey` matches `^[a-z0-9-]{1,64}$` if present, `relationship` is one of the allowed enum values if present. Failures return `Result.Failure(...)` with a Greek message.

#### 4.1 Allowed relationship values

```
parent | child | sibling | spouse | grandparent | friend | colleague | other
```

Stored lowercase, validated in the entity factory. Unknown values cause `Result.Failure` → 400 from the controller.

### `Favorites` table (PostgreSQL)

```sql
CREATE TABLE "Favorites" (
    "Id"            UUID PRIMARY KEY,
    "UserId"        UUID NOT NULL REFERENCES "Users"("Id") ON DELETE CASCADE,
    "DisplayName"   VARCHAR(100) NOT NULL,
    "NameDayKey"    VARCHAR(64),
    "BirthdayDate"  DATE,
    "Relationship"  VARCHAR(32),
    "CreatedAt"     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "UpdatedAt"     TIMESTAMPTZ,
    "DeletedAt"     TIMESTAMPTZ
);

CREATE INDEX "IX_Favorites_UserId_UpdatedAt" ON "Favorites" ("UserId", "UpdatedAt");
CREATE INDEX "IX_Favorites_UserId_Live" ON "Favorites" ("UserId") WHERE "DeletedAt" IS NULL;
```

- `IX_Favorites_UserId_UpdatedAt` supports `?since=` queries (filter by user, sort by update time).
- `IX_Favorites_UserId_Live` is a partial index for the cap check: `COUNT(*) WHERE UserId = X AND DeletedAt IS NULL`. Tiny, fast.
- `ON DELETE CASCADE` ensures favorites disappear if a user is deleted.

## 5. API Endpoints

All endpoints are under `/api/favorites`, all require `[Authorize]`. The fallback authorization policy from Plan 1 (`RequireAuthenticatedUser`) means anonymous (unauthenticated) requests get 401 automatically.

`UserId` is read from the JWT (`ICurrentUser.Id`) on every endpoint — clients never pass it in URLs or bodies. Clients can never address another user's favorites because the repository scopes all queries by `UserId`.

### `GET /api/favorites?since={iso8601}`

Incremental sync.

- `since` query parameter is optional. Omitted → return all live favorites and an empty deletions array (full sync, e.g. on a fresh device).
- Provided → return:
  - `favorites`: rows where `UserId = currentUser AND DeletedAt IS NULL AND (UpdatedAt > since OR (UpdatedAt IS NULL AND CreatedAt > since))`.
  - `deletions`: `Id`s of rows where `UserId = currentUser AND DeletedAt > since`.
- `syncedAt` is the server's UTC time captured at the start of the query; the client uses it as `since` on the next call.

**Response shape (200):**

```json
{
  "favorites": [
    {
      "id": "5a4f...",
      "displayName": "Γιώργος",
      "nameDayKey": "giorgos",
      "birthdayDate": "1990-04-23",
      "relationship": "friend",
      "createdAt": "2026-05-04T10:00:00Z",
      "updatedAt": "2026-05-04T11:00:00Z"
    }
  ],
  "deletions": ["uuid-1", "uuid-2"],
  "syncedAt": "2026-05-04T18:00:00Z"
}
```

### `POST /api/favorites`

Create a new favorite.

**Request body:**

```json
{
  "id": "5a4f...",
  "displayName": "Γιώργος",
  "nameDayKey": "giorgos",
  "birthdayDate": "1990-04-23",
  "relationship": "friend"
}
```

**Behavior:**

1. Validate body via the entity factory.
2. **Idempotency check:** if a favorite with `Id` already exists for `currentUser.Id`, return 200 with the *existing* record unchanged — the body is ignored on this path so retries with stale data still succeed. If `Id` exists for a *different* user, return 409.
3. **Cap check:** if `IEntitlementRepository.IsPremiumAsync(userId)` returns false, count live favorites for the user; if `count >= cap`, return 402.
4. Persist and return 201 with the canonical record.

**Status codes:**
- 201 Created — success.
- 200 OK — idempotent retry of an existing favorite owned by the same user.
- 400 Bad Request — validation failed (missing display name, oversized field, unknown relationship value, malformed slug).
- 402 Payment Required — free tier cap hit.
- 409 Conflict — `id` already exists for a different user.

### `PUT /api/favorites/{id}`

Full-record replace.

**Request body:** same shape as POST, minus `id` (it's in the URL).

**Behavior:**

- Look up by `(id, currentUser.Id)`. If not found, or `DeletedAt` is set, return 404.
- Apply the entity's `Update(...)` method (validates).
- 200 with the updated record.

**Status codes:**
- 200 OK — success.
- 400 Bad Request — validation failed.
- 404 Not Found — favorite doesn't exist, is owned by another user, or is soft-deleted. (Same response for all three to avoid info leak.)

### `DELETE /api/favorites/{id}`

Soft delete (tombstone).

**Behavior:**

- Look up by `(id, currentUser.Id)` filtered to live (`DeletedAt IS NULL`).
- If not found, return 404.
- Call `SoftDelete()` on the entity, save.
- Return 204 with no body.

**Status codes:**
- 204 No Content — success.
- 404 Not Found — favorite doesn't exist, is owned by another user, or is already deleted.

## 6. Entitlement Stub

```csharp
// Application/Common/Interfaces/IEntitlementRepository.cs
public interface IEntitlementRepository
{
    Task<bool> IsPremiumAsync(Guid userId, CancellationToken ct = default);
}
```

```csharp
// Infrastructure/Repositories/StubEntitlementRepository.cs
public sealed class StubEntitlementRepository(ILogger<StubEntitlementRepository> logger)
    : IEntitlementRepository
{
    public Task<bool> IsPremiumAsync(Guid userId, CancellationToken ct = default)
    {
        logger.LogDebug("[STUB ENTITLEMENT] Premium check for {UserId} → false", userId);
        return Task.FromResult(false);
    }
}
```

Registered in DI as `Scoped`. The Adapty plan will add a real implementation backed by the `subscription_entitlements` table and swap the registration; controller code does not change.

### Cap-check flow (in `FavoritesController.Create`)

```csharp
if (!await entitlements.IsPremiumAsync(currentUser.Id, ct))
{
    var cap = config.GetValue<int>("Premium:FreeFavoritesCap");
    var liveCount = await favorites.CountLiveByUserAsync(currentUser.Id, ct);
    if (liveCount >= cap)
    {
        return StatusCode(402, new
        {
            error = $"Έχεις φτάσει το όριο των {cap} αγαπημένων στη δωρεάν έκδοση."
        });
    }
}
```

The cap value is interpolated into the message so the user sees the actual current cap (matters if we tune it).

## 7. Error Responses

All responses are JSON UTF-8 with the `error` key, matching Plan 1's `AuthController`.

| Scenario | Status | Body |
|---|---|---|
| Validation failure | 400 | `{ "error": "<specific Greek message>" }` |
| Unauthenticated | 401 | (handled by JWT middleware) |
| Cap hit | 402 | `{ "error": "Έχεις φτάσει το όριο των {cap} αγαπημένων στη δωρεάν έκδοση." }` (cap value interpolated from config) |
| Not found / not owned / soft-deleted (PUT, DELETE) | 404 | `{ "error": "Δεν βρέθηκε." }` |
| Cross-user UUID collision (POST) | 409 | `{ "error": "Το αναγνωριστικό υπάρχει ήδη." }` |
| Unhandled exception | 500 | (handled by `GlobalExceptionMiddleware`) |

## 8. Tests

Three new test files in `backend/Tests/Favorites/`:

### `FavoriteRepositoryTests.cs`

Repository contract under InMemory EF (matches Plan 1 pattern via `TestDbContextFactory`).

- `AddAsync` persists a favorite.
- `GetByIdForUserAsync` returns null when the favorite is owned by a different user (scope safety).
- `GetSinceAsync` returns rows where `UpdatedAt > since` (or `CreatedAt > since` when `UpdatedAt IS NULL`), excluding tombstones.
- `GetTombstonesSinceAsync` returns IDs where `DeletedAt > since`.
- `CountLiveByUserAsync` excludes soft-deleted rows.
- `Update` bumps `UpdatedAt`.
- `SoftDelete` sets `DeletedAt` and `UpdatedAt`.

### `FavoritesControllerTests.cs`

Controller behavior with mocked repositories.

- `Create` returns 201 with body on success.
- `Create` returns 200 with existing record when same `(userId, id)` already exists (idempotency).
- `Create` returns 409 when `id` exists for a different user.
- `Create` returns 400 on invalid relationship enum value.
- `Create` returns 400 on blank display name.
- `Update` returns 404 when favorite owned by different user.
- `Update` returns 404 when favorite is soft-deleted.
- `Delete` returns 204 and sets `DeletedAt`.
- `Get` returns full sync when `since` omitted.
- `Get` filters by `since` correctly and includes deletions array.

### `EntitlementCapTests.cs`

Cap path edge cases.

- Premium user → cap is not enforced (can create beyond cap).
- Free user at `cap-1` → can create one more.
- Free user at `cap` → 402 on next create.
- Free user at `cap` with one soft-deleted → can create another (live count = `cap-1`, not `cap`).

All Greek error strings asserted as exact-string matches.

## 9. Configuration

Add to `Api/appsettings.json`:

```json
"Premium": {
  "FreeFavoritesCap": 10
}
```

Read at request time via `IConfiguration.GetValue<int>("Premium:FreeFavoritesCap")` so changes take effect on next request without code redeploys requiring entity-level rebuilds. (App restart is still required for `appsettings.json` reload, but no recompile.)

## 10. Out of Scope (Deferred)

- **Adapty webhook + `subscription_entitlements` table.** Future plan. Stub entitlement repo is the seam.
- **Rate limiting on `/api/favorites`.** Spec mentions per-user 60 req/min; defer to a cross-cutting plan that adds rate-limit middleware globally.
- **Cleanup job for stale anonymous users.** Privacy mitigation discussed during brainstorming; defer to ops/maintenance plan.
- **Pagination on `GET`.** With a 10-favorite free cap and reasonable premium use, pagination is YAGNI for v1.
- **`customOverrides` field.** Dropped (decision #4).
- **Sentry / structured logging beyond `ILogger`.** Inherited from Plan 1; no new observability work in this plan.

## 11. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Client clock skew causes `since` cursor to miss updates. | Server returns `syncedAt` based on server UTC clock; clients always echo back what the server gave them, never their own clock. |
| Two concurrent `POST /favorites` from the same user race past the cap (e.g. user is at 9, fires two creates simultaneously, both pass the count check, end up at 11). | Acceptable for v1 — cap is a soft commercial gate, not a security boundary. If observed in practice, add a transaction with `SERIALIZABLE` isolation around the count + insert in the Adapty-integration plan. |
| Soft-deleted favorites accumulate forever, bloating the table. | Acceptable through v1 launch (cap of 10 limits volume). Add a periodic hard-delete job for tombstones older than N days in a future maintenance plan. |
| Anonymous user spam (a bad actor creates many anonymous accounts and floods favorites). | Out of scope for Plan 2; rate-limit middleware in a later plan handles abuse. |

## 12. Success Criteria

Plan 2 is complete when:

1. All endpoints respond with the correct status codes and Greek messages on the documented happy paths and error paths.
2. The `Favorites` table is applied to Supabase with both indexes.
3. All new tests pass (target ~20 new tests across the three files).
4. End-to-end smoke test: create a favorite (anonymous), upgrade with `claim`, list favorites — same UUID survives the claim.
5. End-to-end cap smoke test: create 10 favorites, verify the 11th returns 402 with the Greek message.
6. Existing Plan 1 tests still pass.

---

*End of design.*
