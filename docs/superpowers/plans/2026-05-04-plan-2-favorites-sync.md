# Plan 2: Favorites Sync (Backend) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add server-side favorites storage and incremental cross-device sync to the Celebrations backend, with stub-based premium-cap enforcement (10 favorites for free users).

**Architecture:** Extends Plan 1's Clean Architecture with a `Favorite` aggregate, an EF-backed `FavoriteRepository`, an `IEntitlementRepository` seam (stub-implemented in this plan), and a `FavoritesController` with four REST endpoints. Soft-delete via `DeletedAt` tombstones. Client-generated UUIDs. Single round-trip incremental sync via `?since=` cursor with `favorites[]` + `deletions[]` response shape.

**Tech Stack:** .NET 10, ASP.NET Core, EF Core (queries only), Npgsql, xUnit + Moq + FluentAssertions for tests, EF InMemory for repository/controller tests.

**Source spec:** `docs/superpowers/specs/2026-05-04-favorites-sync-design.md`. Read it before starting — every locked decision (cap value, response shape, idempotency rules, allowed relationship enum, etc.) is justified there.

**Branch:** All work on `feature/plan-2-favorites-sync` in a worktree at `C:\Users\afabu\Desktop\CelebrationsApp\.worktrees\plan-2-favorites-sync`.

**Out of scope (deferred to other plans):**
- Adapty webhook + real `subscription_entitlements` table → future plan
- Rate-limiting middleware → cross-cutting plan
- Cleanup job for stale anonymous users → ops plan
- Pagination on `GET /api/favorites` → not needed at v1 cap
- `customOverrides` field → dropped per design decision #4

---

## File Structure

New files (this plan):

```
backend/
├── Domain/Entities/
│   └── Favorite.cs                              ← new aggregate
├── Application/
│   ├── Common/Interfaces/
│   │   ├── IFavoriteRepository.cs               ← new
│   │   └── IEntitlementRepository.cs            ← new
│   ├── DTOs/
│   │   └── FavoriteDtos.cs                      ← new
│   └── Mapping/
│       └── FavoriteMapping.cs                   ← new
├── Infrastructure/
│   ├── Persistence/Configurations/
│   │   └── FavoriteConfiguration.cs             ← new
│   └── Repositories/
│       ├── FavoriteRepository.cs                ← new
│       └── StubEntitlementRepository.cs         ← new
├── Api/Controllers/
│   └── FavoritesController.cs                   ← new
└── Tests/
    ├── Domain/
    │   └── FavoriteTests.cs                     ← new
    └── Favorites/
        ├── FavoriteRepositoryTests.cs           ← new
        ├── FavoritesControllerTests.cs          ← new
        └── EntitlementCapTests.cs               ← new
```

Modified files:

```
backend/
├── Domain/Common/BaseEntity.cs                  ← add Id-accepting constructor
├── Infrastructure/Persistence/AppDbContext.cs   ← add DbSet<Favorite>
├── Infrastructure/DependencyInjection.cs        ← register IFavoriteRepository + IEntitlementRepository
├── Api/appsettings.json                         ← add Premium:FreeFavoritesCap
├── Api/appsettings.Development.example.json     ← add Premium section
├── database/create_tables.sql                   ← add Favorites table + indexes
└── README.md                                    ← document /api/favorites endpoint group
```

---

## Task 1: Domain — extend BaseEntity to support client-generated IDs

**Why:** `BaseEntity` initializes `Id = Guid.NewGuid()` as a property initializer with a private setter. Plan 2 needs client-generated UUIDs for favorites (decision #6 in spec). We add a protected constructor that accepts an Id; existing entities (User, RefreshToken, PasswordResetToken) keep using the parameterless constructor unchanged.

**Files:**
- Modify: `backend/Domain/Common/BaseEntity.cs`
- Test: `backend/Tests/Domain/BaseEntityTests.cs` (extend existing file)

- [ ] **Step 1: Read existing BaseEntityTests to find the right place to add a test**

Read `backend/Tests/Domain/BaseEntityTests.cs` and note the namespace/class structure.

- [ ] **Step 2: Write the failing test**

Add this test to `backend/Tests/Domain/BaseEntityTests.cs` inside the existing test class:

```csharp
[Fact]
public void Constructor_WithExplicitId_UsesProvidedId()
{
    var explicitId = Guid.Parse("11111111-1111-1111-1111-111111111111");
    var entity = new TestEntityWithExplicitId(explicitId);
    entity.Id.Should().Be(explicitId);
}

private class TestEntityWithExplicitId : BaseEntity
{
    public TestEntityWithExplicitId(Guid id) : base(id) { }
}
```

If the file already has a `TestEntity` private class for the parameterless tests, leave it alone — define `TestEntityWithExplicitId` separately.

- [ ] **Step 3: Run the test to verify it fails to compile**

Run from `backend/`:
```bash
dotnet test --filter "FullyQualifiedName~BaseEntityTests.Constructor_WithExplicitId"
```
Expected: build error — `BaseEntity` has no constructor that takes `Guid`.

- [ ] **Step 4: Add the protected constructor to BaseEntity**

Modify `backend/Domain/Common/BaseEntity.cs` to add a second constructor:

```csharp
namespace Domain.Common;

public abstract class BaseEntity
{
    public Guid Id { get; private set; } = Guid.NewGuid();
    public DateTime CreatedAt { get; private set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; private set; }

    protected BaseEntity() { }

    protected BaseEntity(Guid id)
    {
        Id = id;
    }

    protected void SetUpdated()
    {
        UpdatedAt = DateTime.UtcNow;
    }

    public override bool Equals(object? obj)
    {
        if (obj is not BaseEntity other) return false;
        if (ReferenceEquals(this, other)) return true;
        if (GetType() != other.GetType()) return false;
        return Id == other.Id;
    }

    public override int GetHashCode() => Id.GetHashCode();

    public static bool operator ==(BaseEntity? left, BaseEntity? right)
    {
        if (left is null && right is null) return true;
        if (left is null || right is null) return false;
        return left.Equals(right);
    }

    public static bool operator !=(BaseEntity? left, BaseEntity? right) => !(left == right);
}
```

- [ ] **Step 5: Run all Domain tests to verify nothing regressed**

Run from `backend/`:
```bash
dotnet test --filter "FullyQualifiedName~Tests.Domain"
```
Expected: all tests pass, including the new `Constructor_WithExplicitId_UsesProvidedId`.

- [ ] **Step 6: Commit**

```bash
git add backend/Domain/Common/BaseEntity.cs backend/Tests/Domain/BaseEntityTests.cs
git commit -m "Add Id-accepting constructor to BaseEntity for client-generated UUIDs"
```

---

## Task 2: Domain — Favorite entity

**Files:**
- Create: `backend/Domain/Entities/Favorite.cs`
- Create: `backend/Tests/Domain/FavoriteTests.cs`

- [ ] **Step 1: Write the failing tests**

Create `backend/Tests/Domain/FavoriteTests.cs`:

```csharp
using Domain.Entities;
using FluentAssertions;
using Xunit;

namespace Tests.Domain;

public class FavoriteTests
{
    private static readonly Guid AnyId = Guid.Parse("11111111-1111-1111-1111-111111111111");
    private static readonly Guid AnyUserId = Guid.Parse("22222222-2222-2222-2222-222222222222");

    [Fact]
    public void Create_WithValidInputs_Succeeds()
    {
        var result = Favorite.Create(
            AnyId, AnyUserId, "Γιώργος", "giorgos",
            new DateOnly(1990, 4, 23), "friend");

        result.IsSuccess.Should().BeTrue();
        result.Value!.Id.Should().Be(AnyId);
        result.Value.UserId.Should().Be(AnyUserId);
        result.Value.DisplayName.Should().Be("Γιώργος");
        result.Value.NameDayKey.Should().Be("giorgos");
        result.Value.BirthdayDate.Should().Be(new DateOnly(1990, 4, 23));
        result.Value.Relationship.Should().Be("friend");
        result.Value.DeletedAt.Should().BeNull();
        result.Value.UpdatedAt.Should().BeNull();
    }

    [Fact]
    public void Create_WithBlankDisplayName_Fails()
    {
        var result = Favorite.Create(AnyId, AnyUserId, "   ", null, null, null);
        result.IsFailure.Should().BeTrue();
        result.Error.Should().Contain("όνομα");
    }

    [Fact]
    public void Create_WithDisplayNameOver100Chars_Fails()
    {
        var longName = new string('x', 101);
        var result = Favorite.Create(AnyId, AnyUserId, longName, null, null, null);
        result.IsFailure.Should().BeTrue();
    }

    [Theory]
    [InlineData("Friend")]              // wrong case
    [InlineData("φίλος")]               // Greek
    [InlineData("bestie")]              // not in enum
    [InlineData("")]                    // empty
    public void Create_WithUnknownRelationship_Fails(string relationship)
    {
        var result = Favorite.Create(AnyId, AnyUserId, "Maria", null, null, relationship);
        result.IsFailure.Should().BeTrue();
    }

    [Theory]
    [InlineData("parent")]
    [InlineData("child")]
    [InlineData("sibling")]
    [InlineData("spouse")]
    [InlineData("grandparent")]
    [InlineData("friend")]
    [InlineData("colleague")]
    [InlineData("other")]
    public void Create_WithAllowedRelationship_Succeeds(string relationship)
    {
        var result = Favorite.Create(AnyId, AnyUserId, "Maria", null, null, relationship);
        result.IsSuccess.Should().BeTrue();
    }

    [Theory]
    [InlineData("UPPERCASE")]
    [InlineData("with spaces")]
    [InlineData("with_underscore")]
    [InlineData("greek-Γιώργος")]
    public void Create_WithInvalidNameDayKey_Fails(string key)
    {
        var result = Favorite.Create(AnyId, AnyUserId, "Maria", key, null, null);
        result.IsFailure.Should().BeTrue();
    }

    [Theory]
    [InlineData("giorgos")]
    [InlineData("agia-paraskevi")]
    [InlineData("a")]
    [InlineData("name123")]
    public void Create_WithValidNameDayKey_Succeeds(string key)
    {
        var result = Favorite.Create(AnyId, AnyUserId, "Maria", key, null, null);
        result.IsSuccess.Should().BeTrue();
    }

    [Fact]
    public void Create_TrimsDisplayName()
    {
        var result = Favorite.Create(AnyId, AnyUserId, "  Γιώργος  ", null, null, null);
        result.IsSuccess.Should().BeTrue();
        result.Value!.DisplayName.Should().Be("Γιώργος");
    }

    [Fact]
    public void Create_NullRelationshipAndNameDayKey_Allowed()
    {
        var result = Favorite.Create(AnyId, AnyUserId, "Maria", null, null, null);
        result.IsSuccess.Should().BeTrue();
        result.Value!.NameDayKey.Should().BeNull();
        result.Value.Relationship.Should().BeNull();
    }

    [Fact]
    public void Update_WithValidInputs_BumpsUpdatedAt()
    {
        var fav = Favorite.Create(AnyId, AnyUserId, "Old", null, null, null).Value!;
        var before = DateTime.UtcNow.AddSeconds(-1);

        var result = fav.Update("New", "newkey", new DateOnly(2000, 1, 1), "spouse");

        result.IsSuccess.Should().BeTrue();
        fav.DisplayName.Should().Be("New");
        fav.NameDayKey.Should().Be("newkey");
        fav.BirthdayDate.Should().Be(new DateOnly(2000, 1, 1));
        fav.Relationship.Should().Be("spouse");
        fav.UpdatedAt.Should().NotBeNull();
        fav.UpdatedAt!.Value.Should().BeAfter(before);
    }

    [Fact]
    public void Update_WithBlankDisplayName_Fails()
    {
        var fav = Favorite.Create(AnyId, AnyUserId, "Maria", null, null, null).Value!;
        var result = fav.Update("", null, null, null);
        result.IsFailure.Should().BeTrue();
        fav.DisplayName.Should().Be("Maria");  // unchanged
    }

    [Fact]
    public void SoftDelete_SetsDeletedAtAndUpdatedAt()
    {
        var fav = Favorite.Create(AnyId, AnyUserId, "Maria", null, null, null).Value!;
        var before = DateTime.UtcNow.AddSeconds(-1);

        fav.SoftDelete();

        fav.DeletedAt.Should().NotBeNull();
        fav.DeletedAt!.Value.Should().BeAfter(before);
        fav.UpdatedAt.Should().NotBeNull();
        fav.UpdatedAt!.Value.Should().BeAfter(before);
    }

    [Fact]
    public void SoftDelete_OnAlreadyDeleted_IsIdempotent()
    {
        var fav = Favorite.Create(AnyId, AnyUserId, "Maria", null, null, null).Value!;
        fav.SoftDelete();
        var firstDeletedAt = fav.DeletedAt;

        fav.SoftDelete();   // call again

        // Should not throw; DeletedAt may be the same or later. Just don't crash.
        fav.DeletedAt.Should().NotBeNull();
    }
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run from `backend/`:
```bash
dotnet test --filter "FullyQualifiedName~FavoriteTests"
```
Expected: build error — `Domain.Entities.Favorite` doesn't exist.

- [ ] **Step 3: Create the Favorite entity**

Create `backend/Domain/Entities/Favorite.cs`:

```csharp
using System.Text.RegularExpressions;
using Domain.Common;

namespace Domain.Entities;

public partial class Favorite : BaseEntity
{
    private static readonly HashSet<string> AllowedRelationships = new(StringComparer.Ordinal)
    {
        "parent", "child", "sibling", "spouse",
        "grandparent", "friend", "colleague", "other",
    };

    [GeneratedRegex(@"^[a-z0-9-]{1,64}$")]
    private static partial Regex NameDayKeyRegex();

    public Guid UserId { get; private set; }
    public string DisplayName { get; private set; } = null!;
    public string? NameDayKey { get; private set; }
    public DateOnly? BirthdayDate { get; private set; }
    public string? Relationship { get; private set; }
    public DateTime? DeletedAt { get; private set; }

    private Favorite() { }

    private Favorite(Guid id, Guid userId, string displayName, string? nameDayKey,
                     DateOnly? birthdayDate, string? relationship) : base(id)
    {
        UserId = userId;
        DisplayName = displayName;
        NameDayKey = nameDayKey;
        BirthdayDate = birthdayDate;
        Relationship = relationship;
    }

    public static Result<Favorite> Create(
        Guid id, Guid userId, string displayName, string? nameDayKey,
        DateOnly? birthdayDate, string? relationship)
    {
        var validation = Validate(displayName, nameDayKey, relationship);
        if (validation.IsFailure)
            return Result.Failure<Favorite>(validation.Error);

        return Result.Success(new Favorite(
            id,
            userId,
            displayName.Trim(),
            nameDayKey,
            birthdayDate,
            relationship));
    }

    public Result Update(string displayName, string? nameDayKey,
                         DateOnly? birthdayDate, string? relationship)
    {
        var validation = Validate(displayName, nameDayKey, relationship);
        if (validation.IsFailure)
            return validation;

        DisplayName = displayName.Trim();
        NameDayKey = nameDayKey;
        BirthdayDate = birthdayDate;
        Relationship = relationship;
        SetUpdated();
        return Result.Success();
    }

    public void SoftDelete()
    {
        DeletedAt = DateTime.UtcNow;
        SetUpdated();
    }

    private static Result Validate(string displayName, string? nameDayKey, string? relationship)
    {
        if (string.IsNullOrWhiteSpace(displayName))
            return Result.Failure("Το όνομα είναι υποχρεωτικό.");
        if (displayName.Trim().Length > 100)
            return Result.Failure("Το όνομα δεν μπορεί να ξεπερνά τους 100 χαρακτήρες.");

        if (nameDayKey is not null && !NameDayKeyRegex().IsMatch(nameDayKey))
            return Result.Failure("Μη έγκυρο αναγνωριστικό ονομαστικής.");

        if (relationship is not null && !AllowedRelationships.Contains(relationship))
            return Result.Failure("Μη έγκυρη σχέση.");

        return Result.Success();
    }
}
```

Note: `Result` and `Result<T>` live in `Domain.Common` (used `using Domain.Common` is implicitly available because the file is in `Domain/Entities/` and `BaseEntity` is in `Domain/Common`; check the existing User.cs for how it imports `Domain.Common`. If a `using Domain.Common;` is required, add it).

- [ ] **Step 4: Run tests to verify they pass**

Run from `backend/`:
```bash
dotnet test --filter "FullyQualifiedName~FavoriteTests"
```
Expected: all 14 tests pass (the `[Theory]` cases expand: 4 for `UnknownRelationship`, 8 for `AllowedRelationship`, 4 for `InvalidNameDayKey`, 4 for `ValidNameDayKey`, plus 8 `[Fact]` tests).

- [ ] **Step 5: Commit**

```bash
git add backend/Domain/Entities/Favorite.cs backend/Tests/Domain/FavoriteTests.cs
git commit -m "Add Favorite domain entity with validation and soft-delete"
```

---

## Task 3: Application — IFavoriteRepository interface

**Files:**
- Create: `backend/Application/Common/Interfaces/IFavoriteRepository.cs`

- [ ] **Step 1: Create the interface**

Create `backend/Application/Common/Interfaces/IFavoriteRepository.cs`:

```csharp
using Domain.Entities;
using Domain.Interfaces;

namespace Application.Common.Interfaces;

public interface IFavoriteRepository : IRepository<Favorite>
{
    Task<Favorite?> GetByIdForUserAsync(Guid id, Guid userId, CancellationToken ct = default);

    Task<Favorite?> GetLiveByIdForUserAsync(Guid id, Guid userId, CancellationToken ct = default);

    Task<bool> ExistsAsync(Guid id, CancellationToken ct = default);

    Task<bool> ExistsForOtherUserAsync(Guid id, Guid userId, CancellationToken ct = default);

    Task<int> CountLiveByUserAsync(Guid userId, CancellationToken ct = default);

    Task<List<Favorite>> GetLiveSinceAsync(Guid userId, DateTime? since, CancellationToken ct = default);

    Task<List<Guid>> GetTombstoneIdsSinceAsync(Guid userId, DateTime? since, CancellationToken ct = default);
}
```

- [ ] **Step 2: Verify the project compiles**

Run from `backend/`:
```bash
dotnet build Application/Application.csproj
```
Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
git add backend/Application/Common/Interfaces/IFavoriteRepository.cs
git commit -m "Add IFavoriteRepository interface"
```

---

## Task 4: Application — IEntitlementRepository interface

**Files:**
- Create: `backend/Application/Common/Interfaces/IEntitlementRepository.cs`

- [ ] **Step 1: Create the interface**

Create `backend/Application/Common/Interfaces/IEntitlementRepository.cs`:

```csharp
namespace Application.Common.Interfaces;

public interface IEntitlementRepository
{
    Task<bool> IsPremiumAsync(Guid userId, CancellationToken ct = default);
}
```

- [ ] **Step 2: Verify the project compiles**

Run from `backend/`:
```bash
dotnet build Application/Application.csproj
```
Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
git add backend/Application/Common/Interfaces/IEntitlementRepository.cs
git commit -m "Add IEntitlementRepository interface (stub-backed in Plan 2)"
```

---

## Task 5: Application — FavoriteDtos

**Files:**
- Create: `backend/Application/DTOs/FavoriteDtos.cs`

- [ ] **Step 1: Create the DTOs**

Create `backend/Application/DTOs/FavoriteDtos.cs`:

```csharp
namespace Application.DTOs;

public record FavoriteDto(
    Guid Id,
    string DisplayName,
    string? NameDayKey,
    DateOnly? BirthdayDate,
    string? Relationship,
    DateTime CreatedAt,
    DateTime? UpdatedAt);

public record CreateFavoriteRequest(
    Guid Id,
    string DisplayName,
    string? NameDayKey,
    DateOnly? BirthdayDate,
    string? Relationship);

public record UpdateFavoriteRequest(
    string DisplayName,
    string? NameDayKey,
    DateOnly? BirthdayDate,
    string? Relationship);

public record FavoritesSyncResponse(
    IReadOnlyList<FavoriteDto> Favorites,
    IReadOnlyList<Guid> Deletions,
    DateTime SyncedAt);
```

- [ ] **Step 2: Verify the project compiles**

Run from `backend/`:
```bash
dotnet build Application/Application.csproj
```
Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
git add backend/Application/DTOs/FavoriteDtos.cs
git commit -m "Add favorite DTOs (request, response, sync envelope)"
```

---

## Task 6: Application — FavoriteMapping

**Files:**
- Create: `backend/Application/Mapping/FavoriteMapping.cs`

- [ ] **Step 1: Create the mapping**

Create `backend/Application/Mapping/FavoriteMapping.cs`:

```csharp
using Application.DTOs;
using Domain.Entities;

namespace Application.Mapping;

public static class FavoriteMapping
{
    public static FavoriteDto ToDto(this Favorite favorite) => new(
        favorite.Id,
        favorite.DisplayName,
        favorite.NameDayKey,
        favorite.BirthdayDate,
        favorite.Relationship,
        favorite.CreatedAt,
        favorite.UpdatedAt);
}
```

- [ ] **Step 2: Verify the project compiles**

Run from `backend/`:
```bash
dotnet build Application/Application.csproj
```
Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
git add backend/Application/Mapping/FavoriteMapping.cs
git commit -m "Add Favorite → FavoriteDto mapping extension"
```

---

## Task 7: Infrastructure — FavoriteConfiguration (EF)

**Files:**
- Create: `backend/Infrastructure/Persistence/Configurations/FavoriteConfiguration.cs`

- [ ] **Step 1: Create the configuration**

Create `backend/Infrastructure/Persistence/Configurations/FavoriteConfiguration.cs`:

```csharp
using Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Infrastructure.Persistence.Configurations;

public class FavoriteConfiguration : IEntityTypeConfiguration<Favorite>
{
    public void Configure(EntityTypeBuilder<Favorite> builder)
    {
        builder.ToTable("Favorites");
        builder.HasKey(f => f.Id);

        builder.Property(f => f.UserId).IsRequired();

        builder.Property(f => f.DisplayName)
            .IsRequired()
            .HasMaxLength(100);

        builder.Property(f => f.NameDayKey)
            .HasMaxLength(64);

        builder.Property(f => f.BirthdayDate)
            .HasColumnType("date");

        builder.Property(f => f.Relationship)
            .HasMaxLength(32);

        builder.Property(f => f.CreatedAt).IsRequired();

        // Indexes mirror those declared in database/create_tables.sql:
        //   - (UserId, UpdatedAt) — supports ?since= queries
        //   - (UserId) WHERE DeletedAt IS NULL — partial index for cap count
        // EF Core can't express partial indexes, so the partial index is SQL-only.
        builder.HasIndex(f => new { f.UserId, f.UpdatedAt })
            .HasDatabaseName("IX_Favorites_UserId_UpdatedAt");
    }
}
```

- [ ] **Step 2: Verify the project compiles**

Run from `backend/`:
```bash
dotnet build Infrastructure/Infrastructure.csproj
```
Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
git add backend/Infrastructure/Persistence/Configurations/FavoriteConfiguration.cs
git commit -m "Add EF configuration for Favorite entity"
```

---

## Task 8: Infrastructure — register Favorite in AppDbContext

**Files:**
- Modify: `backend/Infrastructure/Persistence/AppDbContext.cs`

- [ ] **Step 1: Update AppDbContext**

Replace `backend/Infrastructure/Persistence/AppDbContext.cs` with:

```csharp
using Domain.Entities;
using Infrastructure.Persistence.Configurations;
using Microsoft.EntityFrameworkCore;

namespace Infrastructure.Persistence;

public class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    public DbSet<User> Users => Set<User>();
    public DbSet<RefreshToken> RefreshTokens => Set<RefreshToken>();
    public DbSet<PasswordResetToken> PasswordResetTokens => Set<PasswordResetToken>();
    public DbSet<Favorite> Favorites => Set<Favorite>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.ApplyConfiguration(new UserConfiguration());
        modelBuilder.ApplyConfiguration(new RefreshTokenConfiguration());
        modelBuilder.ApplyConfiguration(new PasswordResetTokenConfiguration());
        modelBuilder.ApplyConfiguration(new FavoriteConfiguration());
        base.OnModelCreating(modelBuilder);
    }
}
```

- [ ] **Step 2: Verify the project compiles**

Run from `backend/`:
```bash
dotnet build Infrastructure/Infrastructure.csproj
```
Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
git add backend/Infrastructure/Persistence/AppDbContext.cs
git commit -m "Add DbSet<Favorite> to AppDbContext"
```

---

## Task 9: Infrastructure — FavoriteRepository

**Files:**
- Create: `backend/Infrastructure/Repositories/FavoriteRepository.cs`

- [ ] **Step 1: Create the repository**

Create `backend/Infrastructure/Repositories/FavoriteRepository.cs`:

```csharp
using Application.Common.Interfaces;
using Domain.Entities;
using Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Infrastructure.Repositories;

public class FavoriteRepository(AppDbContext context)
    : BaseRepository<Favorite>(context), IFavoriteRepository
{
    public Task<Favorite?> GetByIdForUserAsync(Guid id, Guid userId, CancellationToken ct = default)
        => _dbSet.FirstOrDefaultAsync(f => f.Id == id && f.UserId == userId, ct);

    public Task<Favorite?> GetLiveByIdForUserAsync(Guid id, Guid userId, CancellationToken ct = default)
        => _dbSet.FirstOrDefaultAsync(f => f.Id == id && f.UserId == userId && f.DeletedAt == null, ct);

    public Task<bool> ExistsAsync(Guid id, CancellationToken ct = default)
        => _dbSet.AnyAsync(f => f.Id == id, ct);

    public Task<bool> ExistsForOtherUserAsync(Guid id, Guid userId, CancellationToken ct = default)
        => _dbSet.AnyAsync(f => f.Id == id && f.UserId != userId, ct);

    public Task<int> CountLiveByUserAsync(Guid userId, CancellationToken ct = default)
        => _dbSet.CountAsync(f => f.UserId == userId && f.DeletedAt == null, ct);

    public async Task<List<Favorite>> GetLiveSinceAsync(Guid userId, DateTime? since, CancellationToken ct = default)
    {
        var query = _dbSet.Where(f => f.UserId == userId && f.DeletedAt == null);
        if (since.HasValue)
        {
            var cutoff = since.Value;
            query = query.Where(f =>
                (f.UpdatedAt != null && f.UpdatedAt > cutoff) ||
                (f.UpdatedAt == null && f.CreatedAt > cutoff));
        }
        return await query.ToListAsync(ct);
    }

    public async Task<List<Guid>> GetTombstoneIdsSinceAsync(Guid userId, DateTime? since, CancellationToken ct = default)
    {
        var query = _dbSet.Where(f => f.UserId == userId && f.DeletedAt != null);
        if (since.HasValue)
        {
            var cutoff = since.Value;
            query = query.Where(f => f.DeletedAt > cutoff);
        }
        return await query.Select(f => f.Id).ToListAsync(ct);
    }
}
```

- [ ] **Step 2: Verify the project compiles**

Run from `backend/`:
```bash
dotnet build Infrastructure/Infrastructure.csproj
```
Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
git add backend/Infrastructure/Repositories/FavoriteRepository.cs
git commit -m "Add FavoriteRepository with scoped queries and sync filters"
```

---

## Task 10: Infrastructure — StubEntitlementRepository

**Files:**
- Create: `backend/Infrastructure/Repositories/StubEntitlementRepository.cs`

- [ ] **Step 1: Create the stub**

Create `backend/Infrastructure/Repositories/StubEntitlementRepository.cs`:

```csharp
using Application.Common.Interfaces;
using Microsoft.Extensions.Logging;

namespace Infrastructure.Repositories;

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

- [ ] **Step 2: Verify the project compiles**

Run from `backend/`:
```bash
dotnet build Infrastructure/Infrastructure.csproj
```
Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
git add backend/Infrastructure/Repositories/StubEntitlementRepository.cs
git commit -m "Add StubEntitlementRepository (always returns false)"
```

---

## Task 11: Infrastructure — register new services in DependencyInjection

**Files:**
- Modify: `backend/Infrastructure/DependencyInjection.cs`

- [ ] **Step 1: Update DependencyInjection**

Replace `backend/Infrastructure/DependencyInjection.cs` with:

```csharp
using Application.Common.Interfaces;
using Infrastructure.Authentication;
using Infrastructure.Email;
using Infrastructure.Persistence;
using Infrastructure.Repositories;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructure(this IServiceCollection services, IConfiguration configuration)
    {
        services.AddDbContext<AppDbContext>(options =>
            options.UseNpgsql(
                configuration.GetConnectionString("DefaultConnection"),
                npgsql => npgsql.EnableRetryOnFailure(
                    maxRetryCount: 3,
                    maxRetryDelay: TimeSpan.FromSeconds(10),
                    errorCodesToAdd: null)));

        // Auth wiring
        services.Configure<JwtSettings>(configuration.GetSection(JwtSettings.SectionName));
        services.AddHttpContextAccessor();
        services.AddScoped<IPasswordHasher, BCryptPasswordHasher>();
        services.AddScoped<IJwtTokenService, JwtTokenService>();
        services.AddScoped<ICurrentUser, CurrentUserService>();
        services.AddScoped<IAuthService, AuthService>();
        services.AddScoped<IEmailService, StubEmailService>();
        services.AddSingleton<PasswordResetRateLimiter>();

        // Repositories
        services.AddScoped<IUserRepository, UserRepository>();
        services.AddScoped<IRefreshTokenRepository, RefreshTokenRepository>();
        services.AddScoped<IPasswordResetTokenRepository, PasswordResetTokenRepository>();
        services.AddScoped<IFavoriteRepository, FavoriteRepository>();
        services.AddScoped<IEntitlementRepository, StubEntitlementRepository>();

        return services;
    }
}
```

- [ ] **Step 2: Verify the project compiles**

Run from `backend/`:
```bash
dotnet build Infrastructure/Infrastructure.csproj
```
Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
git add backend/Infrastructure/DependencyInjection.cs
git commit -m "Register IFavoriteRepository and IEntitlementRepository in DI"
```

---

## Task 12: Database — Favorites table in create_tables.sql

**Files:**
- Modify: `backend/database/create_tables.sql`

- [ ] **Step 1: Update the SQL file**

Replace `backend/database/create_tables.sql` with:

```sql
-- Celebrations Database Schema
-- Phase 1 (auth foundations) + Phase 2 (favorites sync).
-- Drop all tables for clean recreation (no production data yet).
DROP TABLE IF EXISTS "Favorites" CASCADE;
DROP TABLE IF EXISTS "PasswordResetTokens" CASCADE;
DROP TABLE IF EXISTS "RefreshTokens" CASCADE;
DROP TABLE IF EXISTS "Users" CASCADE;

-- ============================================================
-- USERS (anonymous-default + email/password registration)
-- ============================================================
CREATE TABLE "Users" (
    "Id"            UUID PRIMARY KEY,
    "Email"         VARCHAR(256),                       -- NULL for anonymous users
    "PasswordHash"  TEXT,                               -- NULL for anonymous users
    "IsAnonymous"   BOOLEAN         NOT NULL DEFAULT FALSE,
    "Status"        VARCHAR(20)     NOT NULL DEFAULT 'Active',
    "CreatedAt"     TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    "UpdatedAt"     TIMESTAMPTZ
);

-- Email is unique among non-anonymous users only. Anonymous users have NULL email
-- and PostgreSQL treats NULLs as distinct in standard unique indexes, so a
-- partial unique index gives us the right semantics.
CREATE UNIQUE INDEX "IX_Users_Email_Unique"
    ON "Users" ("Email")
    WHERE "Email" IS NOT NULL;

-- ============================================================
-- REFRESH TOKENS (rotated on every refresh; only hashes stored)
-- ============================================================
CREATE TABLE "RefreshTokens" (
    "Id"            UUID PRIMARY KEY,
    "UserId"        UUID            NOT NULL REFERENCES "Users"("Id") ON DELETE CASCADE,
    "TokenHash"     TEXT            NOT NULL,
    "ExpiresAt"     TIMESTAMPTZ     NOT NULL,
    "RevokedAt"     TIMESTAMPTZ,
    "CreatedAt"     TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    "UpdatedAt"     TIMESTAMPTZ
);

CREATE UNIQUE INDEX "IX_RefreshTokens_TokenHash" ON "RefreshTokens" ("TokenHash");
CREATE INDEX "IX_RefreshTokens_UserId" ON "RefreshTokens" ("UserId");

-- ============================================================
-- PASSWORD RESET TOKENS (1-hour TTL, single-use, hashes only)
-- ============================================================
CREATE TABLE "PasswordResetTokens" (
    "Id"            UUID PRIMARY KEY,
    "UserId"        UUID            NOT NULL REFERENCES "Users"("Id") ON DELETE CASCADE,
    "TokenHash"     TEXT            NOT NULL,
    "ExpiresAt"     TIMESTAMPTZ     NOT NULL,
    "UsedAt"        TIMESTAMPTZ,
    "CreatedAt"     TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    "UpdatedAt"     TIMESTAMPTZ
);

CREATE UNIQUE INDEX "IX_PasswordResetTokens_TokenHash" ON "PasswordResetTokens" ("TokenHash");
CREATE INDEX "IX_PasswordResetTokens_UserId" ON "PasswordResetTokens" ("UserId");

-- ============================================================
-- FAVORITES (sync target; client-generated UUIDs; soft-delete tombstones)
-- ============================================================
CREATE TABLE "Favorites" (
    "Id"            UUID PRIMARY KEY,
    "UserId"        UUID            NOT NULL REFERENCES "Users"("Id") ON DELETE CASCADE,
    "DisplayName"   VARCHAR(100)    NOT NULL,
    "NameDayKey"    VARCHAR(64),
    "BirthdayDate"  DATE,
    "Relationship"  VARCHAR(32),
    "CreatedAt"     TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    "UpdatedAt"     TIMESTAMPTZ,
    "DeletedAt"     TIMESTAMPTZ
);

-- Supports incremental sync via ?since= queries (filter by user, sort by update time).
CREATE INDEX "IX_Favorites_UserId_UpdatedAt" ON "Favorites" ("UserId", "UpdatedAt");

-- Partial index for the free-tier cap check: COUNT(*) WHERE UserId = X AND DeletedAt IS NULL.
-- Only indexes live rows, keeping it small and fast.
CREATE INDEX "IX_Favorites_UserId_Live" ON "Favorites" ("UserId") WHERE "DeletedAt" IS NULL;
```

- [ ] **Step 2: Commit**

```bash
git add backend/database/create_tables.sql
git commit -m "Add Favorites table to schema with sync and cap-count indexes"
```

(The SQL is applied to Supabase in Task 19's smoke test, not now.)

---

## Task 13: API — appsettings additions

**Files:**
- Modify: `backend/Api/appsettings.json`
- Modify: `backend/Api/appsettings.Development.example.json`

- [ ] **Step 1: Read the current appsettings.json to understand its shape**

Read `backend/Api/appsettings.json` and note its current structure. It contains an empty `ConnectionStrings`, a `Jwt` section with a placeholder key, and `Logging`/`AllowedHosts`.

- [ ] **Step 2: Update appsettings.json**

Open `backend/Api/appsettings.json` and add a top-level `Premium` section (next to the existing `Jwt` section). The full file should look like this — keep all existing sections and values, just add the `Premium` block:

```json
{
  "Logging": {
    "LogLevel": {
      "Default": "Information",
      "Microsoft.AspNetCore": "Warning"
    }
  },
  "AllowedHosts": "*",
  "ConnectionStrings": {
    "DefaultConnection": ""
  },
  "Jwt": {
    "Key": "",
    "Issuer": "celebrations-api",
    "Audience": "celebrations-app",
    "AccessTokenMinutes": 15,
    "RefreshTokenDays": 30
  },
  "Premium": {
    "FreeFavoritesCap": 10
  }
}
```

(If the existing values for `Jwt`/`ConnectionStrings`/`Logging` differ, preserve them — only add `Premium`.)

- [ ] **Step 3: Update appsettings.Development.example.json**

Open `backend/Api/appsettings.Development.example.json` and add a `Premium` block. The full file should be:

```json
{
  "ConnectionStrings": {
    "DefaultConnection": "Host=localhost;Port=5432;Database=celebrations;Username=celebrations;Password=celebrations_dev"
  },
  "Jwt": {
    "Key": "dev-only-not-for-production-replace-me-min-32-chars-required-here-1234567890",
    "Issuer": "celebrations-api",
    "Audience": "celebrations-app",
    "AccessTokenMinutes": 15,
    "RefreshTokenDays": 30
  },
  "Premium": {
    "FreeFavoritesCap": 10
  }
}
```

- [ ] **Step 4: Commit**

```bash
git add backend/Api/appsettings.json backend/Api/appsettings.Development.example.json
git commit -m "Add Premium:FreeFavoritesCap config (default 10)"
```

---

## Task 14: API — FavoritesController

**Files:**
- Create: `backend/Api/Controllers/FavoritesController.cs`

- [ ] **Step 1: Create the controller**

Create `backend/Api/Controllers/FavoritesController.cs`:

```csharp
using Application.Common.Interfaces;
using Application.DTOs;
using Application.Mapping;
using Domain.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Configuration;

namespace Api.Controllers;

[ApiController]
[Route("api/favorites")]
[Authorize]
public class FavoritesController(
    IFavoriteRepository favorites,
    IEntitlementRepository entitlements,
    ICurrentUser currentUser,
    IConfiguration config) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<FavoritesSyncResponse>> GetAll(
        [FromQuery] DateTime? since,
        CancellationToken ct)
    {
        if (currentUser.UserId is not Guid userId) return Unauthorized();

        var syncedAt = DateTime.UtcNow;
        var live = await favorites.GetLiveSinceAsync(userId, since, ct);
        var deletions = await favorites.GetTombstoneIdsSinceAsync(userId, since, ct);

        var dtos = live.Select(f => f.ToDto()).ToList();
        return Ok(new FavoritesSyncResponse(dtos, deletions, syncedAt));
    }

    [HttpPost]
    public async Task<ActionResult<FavoriteDto>> Create(
        [FromBody] CreateFavoriteRequest request,
        CancellationToken ct)
    {
        if (currentUser.UserId is not Guid userId) return Unauthorized();

        // Idempotency: same (userId, id) returns the existing record.
        var existing = await favorites.GetByIdForUserAsync(request.Id, userId, ct);
        if (existing is not null) return Ok(existing.ToDto());

        // Cross-user UUID collision.
        if (await favorites.ExistsForOtherUserAsync(request.Id, userId, ct))
            return Conflict(new { error = "Το αναγνωριστικό υπάρχει ήδη." });

        // Cap check (skipped for premium users).
        if (!await entitlements.IsPremiumAsync(userId, ct))
        {
            var cap = config.GetValue<int>("Premium:FreeFavoritesCap");
            var count = await favorites.CountLiveByUserAsync(userId, ct);
            if (count >= cap)
            {
                return StatusCode(402, new
                {
                    error = $"Έχεις φτάσει το όριο των {cap} αγαπημένων στη δωρεάν έκδοση."
                });
            }
        }

        var creation = Favorite.Create(
            request.Id, userId,
            request.DisplayName, request.NameDayKey,
            request.BirthdayDate, request.Relationship);
        if (creation.IsFailure) return BadRequest(new { error = creation.Error });

        await favorites.AddAsync(creation.Value!, ct);
        await favorites.SaveChangesAsync(ct);

        return CreatedAtAction(nameof(GetAll), new { id = creation.Value!.Id }, creation.Value.ToDto());
    }

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<FavoriteDto>> Update(
        Guid id,
        [FromBody] UpdateFavoriteRequest request,
        CancellationToken ct)
    {
        if (currentUser.UserId is not Guid userId) return Unauthorized();

        var favorite = await favorites.GetLiveByIdForUserAsync(id, userId, ct);
        if (favorite is null) return NotFound(new { error = "Δεν βρέθηκε." });

        var update = favorite.Update(
            request.DisplayName, request.NameDayKey,
            request.BirthdayDate, request.Relationship);
        if (update.IsFailure) return BadRequest(new { error = update.Error });

        favorites.Update(favorite);
        await favorites.SaveChangesAsync(ct);

        return Ok(favorite.ToDto());
    }

    [HttpDelete("{id:guid}")]
    public async Task<ActionResult> Delete(Guid id, CancellationToken ct)
    {
        if (currentUser.UserId is not Guid userId) return Unauthorized();

        var favorite = await favorites.GetLiveByIdForUserAsync(id, userId, ct);
        if (favorite is null) return NotFound(new { error = "Δεν βρέθηκε." });

        favorite.SoftDelete();
        favorites.Update(favorite);
        await favorites.SaveChangesAsync(ct);

        return NoContent();
    }
}
```

- [ ] **Step 2: Verify the project compiles**

Run from `backend/`:
```bash
dotnet build Api/Api.csproj
```
Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
git add backend/Api/Controllers/FavoritesController.cs
git commit -m "Add FavoritesController with GET/POST/PUT/DELETE endpoints"
```

---

## Task 15: Tests — FavoriteRepository tests

**Files:**
- Create: `backend/Tests/Favorites/FavoriteRepositoryTests.cs`

- [ ] **Step 1: Create the tests**

Create `backend/Tests/Favorites/FavoriteRepositoryTests.cs`:

```csharp
using Domain.Entities;
using FluentAssertions;
using Infrastructure.Persistence;
using Infrastructure.Repositories;
using Tests.Helpers;
using Xunit;

namespace Tests.Favorites;

public class FavoriteRepositoryTests
{
    private static readonly Guid UserA = Guid.Parse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
    private static readonly Guid UserB = Guid.Parse("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb");

    private static (FavoriteRepository repo, AppDbContext ctx) Sut()
    {
        var ctx = TestDbContextFactory.Create();
        return (new FavoriteRepository(ctx), ctx);
    }

    private static async Task<Favorite> AddAsync(FavoriteRepository repo, Guid userId,
        string name = "Maria", string? nameDayKey = null, string? relationship = null)
    {
        var fav = Favorite.Create(Guid.NewGuid(), userId, name, nameDayKey, null, relationship).Value!;
        await repo.AddAsync(fav);
        await repo.SaveChangesAsync();
        return fav;
    }

    [Fact]
    public async Task AddAsync_PersistsFavorite()
    {
        var (repo, _) = Sut();
        var fav = await AddAsync(repo, UserA, "Γιώργος");

        var loaded = await repo.GetByIdForUserAsync(fav.Id, UserA);
        loaded.Should().NotBeNull();
        loaded!.DisplayName.Should().Be("Γιώργος");
    }

    [Fact]
    public async Task GetByIdForUserAsync_ReturnsNullForDifferentUser()
    {
        var (repo, _) = Sut();
        var fav = await AddAsync(repo, UserA);

        var loaded = await repo.GetByIdForUserAsync(fav.Id, UserB);
        loaded.Should().BeNull();
    }

    [Fact]
    public async Task GetLiveByIdForUserAsync_ReturnsNullForSoftDeleted()
    {
        var (repo, _) = Sut();
        var fav = await AddAsync(repo, UserA);
        fav.SoftDelete();
        repo.Update(fav);
        await repo.SaveChangesAsync();

        var live = await repo.GetLiveByIdForUserAsync(fav.Id, UserA);
        live.Should().BeNull();

        // Non-live getter still finds it
        var any = await repo.GetByIdForUserAsync(fav.Id, UserA);
        any.Should().NotBeNull();
    }

    [Fact]
    public async Task ExistsForOtherUserAsync_TrueWhenOtherUserOwnsId()
    {
        var (repo, _) = Sut();
        var fav = await AddAsync(repo, UserA);

        var collision = await repo.ExistsForOtherUserAsync(fav.Id, UserB);
        collision.Should().BeTrue();

        var sameUser = await repo.ExistsForOtherUserAsync(fav.Id, UserA);
        sameUser.Should().BeFalse();
    }

    [Fact]
    public async Task CountLiveByUserAsync_ExcludesSoftDeleted()
    {
        var (repo, _) = Sut();
        var f1 = await AddAsync(repo, UserA);
        await AddAsync(repo, UserA);
        await AddAsync(repo, UserA);
        await AddAsync(repo, UserB);

        f1.SoftDelete();
        repo.Update(f1);
        await repo.SaveChangesAsync();

        (await repo.CountLiveByUserAsync(UserA)).Should().Be(2);
        (await repo.CountLiveByUserAsync(UserB)).Should().Be(1);
    }

    [Fact]
    public async Task GetLiveSinceAsync_NullSince_ReturnsAllLive()
    {
        var (repo, _) = Sut();
        await AddAsync(repo, UserA, "A");
        await AddAsync(repo, UserA, "B");
        var c = await AddAsync(repo, UserA, "C");
        c.SoftDelete();
        repo.Update(c);
        await repo.SaveChangesAsync();

        var results = await repo.GetLiveSinceAsync(UserA, since: null);
        results.Should().HaveCount(2);
        results.Select(f => f.DisplayName).Should().Contain(new[] { "A", "B" });
    }

    [Fact]
    public async Task GetLiveSinceAsync_FiltersByCutoff()
    {
        var (repo, _) = Sut();

        var first = await AddAsync(repo, UserA, "First");
        await Task.Delay(20);
        var cutoff = DateTime.UtcNow;
        await Task.Delay(20);
        var second = await AddAsync(repo, UserA, "Second");

        var results = await repo.GetLiveSinceAsync(UserA, since: cutoff);
        results.Should().HaveCount(1);
        results[0].Id.Should().Be(second.Id);
    }

    [Fact]
    public async Task GetLiveSinceAsync_PicksUpUpdatedRows()
    {
        var (repo, _) = Sut();
        var fav = await AddAsync(repo, UserA, "Original");
        await Task.Delay(20);
        var cutoff = DateTime.UtcNow;
        await Task.Delay(20);

        fav.Update("Renamed", null, null, null);
        repo.Update(fav);
        await repo.SaveChangesAsync();

        var results = await repo.GetLiveSinceAsync(UserA, since: cutoff);
        results.Should().HaveCount(1);
        results[0].DisplayName.Should().Be("Renamed");
    }

    [Fact]
    public async Task GetTombstoneIdsSinceAsync_ReturnsOnlyDeletedAfterCutoff()
    {
        var (repo, _) = Sut();
        var oldDeleted = await AddAsync(repo, UserA, "old");
        oldDeleted.SoftDelete();
        repo.Update(oldDeleted);
        await repo.SaveChangesAsync();

        await Task.Delay(20);
        var cutoff = DateTime.UtcNow;
        await Task.Delay(20);

        var newDeleted = await AddAsync(repo, UserA, "new");
        newDeleted.SoftDelete();
        repo.Update(newDeleted);
        await repo.SaveChangesAsync();

        // A live row that should never appear in tombstones
        await AddAsync(repo, UserA, "live");

        var ids = await repo.GetTombstoneIdsSinceAsync(UserA, since: cutoff);
        ids.Should().HaveCount(1);
        ids[0].Should().Be(newDeleted.Id);
    }

    [Fact]
    public async Task GetTombstoneIdsSinceAsync_ScopedToUser()
    {
        var (repo, _) = Sut();
        var aDeleted = await AddAsync(repo, UserA, "a");
        var bDeleted = await AddAsync(repo, UserB, "b");

        aDeleted.SoftDelete();
        bDeleted.SoftDelete();
        repo.Update(aDeleted);
        repo.Update(bDeleted);
        await repo.SaveChangesAsync();

        var idsA = await repo.GetTombstoneIdsSinceAsync(UserA, since: null);
        idsA.Should().ContainSingle().Which.Should().Be(aDeleted.Id);
    }
}
```

- [ ] **Step 2: Run the tests**

Run from `backend/`:
```bash
dotnet test --filter "FullyQualifiedName~FavoriteRepositoryTests"
```
Expected: all 10 tests pass.

- [ ] **Step 3: Commit**

```bash
git add backend/Tests/Favorites/FavoriteRepositoryTests.cs
git commit -m "Add FavoriteRepository tests covering scope, sync filters, soft-delete"
```

---

## Task 16: Tests — FavoritesController tests

**Files:**
- Create: `backend/Tests/Favorites/FavoritesControllerTests.cs`

- [ ] **Step 1: Create the tests**

Create `backend/Tests/Favorites/FavoritesControllerTests.cs`:

```csharp
using Api.Controllers;
using Application.Common.Interfaces;
using Application.DTOs;
using Domain.Entities;
using FluentAssertions;
using Infrastructure.Repositories;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using Tests.Helpers;
using Xunit;

namespace Tests.Favorites;

public class FavoritesControllerTests
{
    private static readonly Guid UserA = Guid.Parse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
    private static readonly Guid UserB = Guid.Parse("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb");

    private static (FavoritesController controller, FavoriteRepository repo) Sut(
        Guid currentUserId, bool isPremium = false, int cap = 10)
    {
        var ctx = TestDbContextFactory.Create();
        var repo = new FavoriteRepository(ctx);

        var entitlements = new Mock<IEntitlementRepository>();
        entitlements
            .Setup(e => e.IsPremiumAsync(It.IsAny<Guid>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(isPremium);

        var currentUser = new Mock<ICurrentUser>();
        currentUser.SetupGet(c => c.UserId).Returns(currentUserId);
        currentUser.SetupGet(c => c.IsAuthenticated).Returns(true);
        currentUser.SetupGet(c => c.IsAnonymous).Returns(false);

        var configValues = new Dictionary<string, string?>
        {
            ["Premium:FreeFavoritesCap"] = cap.ToString(),
        };
        var config = new ConfigurationBuilder().AddInMemoryCollection(configValues).Build();

        var controller = new FavoritesController(repo, entitlements.Object, currentUser.Object, config);
        return (controller, repo);
    }

    private static CreateFavoriteRequest NewRequest(Guid? id = null, string name = "Maria",
        string? nameDayKey = null, string? relationship = null)
        => new(id ?? Guid.NewGuid(), name, nameDayKey, null, relationship);

    [Fact]
    public async Task Create_Valid_Returns201WithDto()
    {
        var (controller, _) = Sut(UserA);
        var req = NewRequest(name: "Γιώργος", nameDayKey: "giorgos", relationship: "friend");

        var result = await controller.Create(req, CancellationToken.None);

        var created = result.Result.Should().BeOfType<CreatedAtActionResult>().Subject;
        var dto = created.Value.Should().BeOfType<FavoriteDto>().Subject;
        dto.Id.Should().Be(req.Id);
        dto.DisplayName.Should().Be("Γιώργος");
    }

    [Fact]
    public async Task Create_DuplicateIdSameUser_Returns200WithExisting()
    {
        var (controller, _) = Sut(UserA);
        var id = Guid.NewGuid();
        await controller.Create(NewRequest(id, "First"), CancellationToken.None);

        // Retry with different body but same id+user
        var result = await controller.Create(NewRequest(id, "Second"), CancellationToken.None);

        var ok = result.Result.Should().BeOfType<OkObjectResult>().Subject;
        var dto = ok.Value.Should().BeOfType<FavoriteDto>().Subject;
        dto.DisplayName.Should().Be("First");   // existing record returned, body ignored
    }

    [Fact]
    public async Task Create_DifferentUserHoldsId_Returns409()
    {
        var (controllerA, _) = Sut(UserA);
        var id = Guid.NewGuid();
        await controllerA.Create(NewRequest(id, "MineA"), CancellationToken.None);

        var (controllerB, _) = Sut(UserB);
        // Reuse the same in-memory DB? No — Sut() creates a new context. Wire up shared one.
        // Instead, both controllers need to share a context. Build a shared SUT for this test:
        var ctx = TestDbContextFactory.Create();
        var sharedRepo = new FavoriteRepository(ctx);

        var entitlements = new Mock<IEntitlementRepository>();
        entitlements.Setup(e => e.IsPremiumAsync(It.IsAny<Guid>(), It.IsAny<CancellationToken>()))
                    .ReturnsAsync(false);

        var configValues = new Dictionary<string, string?> { ["Premium:FreeFavoritesCap"] = "10" };
        var config = new ConfigurationBuilder().AddInMemoryCollection(configValues).Build();

        var currentA = new Mock<ICurrentUser>();
        currentA.SetupGet(c => c.UserId).Returns(UserA);
        var ctlA = new FavoritesController(sharedRepo, entitlements.Object, currentA.Object, config);

        var currentB = new Mock<ICurrentUser>();
        currentB.SetupGet(c => c.UserId).Returns(UserB);
        var ctlB = new FavoritesController(sharedRepo, entitlements.Object, currentB.Object, config);

        await ctlA.Create(NewRequest(id, "MineA"), CancellationToken.None);
        var result = await ctlB.Create(NewRequest(id, "MineB"), CancellationToken.None);

        var conflict = result.Result.Should().BeOfType<ConflictObjectResult>().Subject;
        conflict.StatusCode.Should().Be(409);
    }

    [Fact]
    public async Task Create_InvalidRelationship_Returns400()
    {
        var (controller, _) = Sut(UserA);
        var req = NewRequest(name: "Maria", relationship: "bestie");

        var result = await controller.Create(req, CancellationToken.None);

        result.Result.Should().BeOfType<BadRequestObjectResult>();
    }

    [Fact]
    public async Task Create_BlankDisplayName_Returns400()
    {
        var (controller, _) = Sut(UserA);
        var req = NewRequest(name: "   ");

        var result = await controller.Create(req, CancellationToken.None);

        result.Result.Should().BeOfType<BadRequestObjectResult>();
    }

    [Fact]
    public async Task Update_NotOwnedByUser_Returns404()
    {
        // Shared context so both users hit the same row.
        var ctx = TestDbContextFactory.Create();
        var sharedRepo = new FavoriteRepository(ctx);

        var ent = new Mock<IEntitlementRepository>();
        ent.Setup(e => e.IsPremiumAsync(It.IsAny<Guid>(), It.IsAny<CancellationToken>())).ReturnsAsync(false);
        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?> { ["Premium:FreeFavoritesCap"] = "10" })
            .Build();

        var currentA = new Mock<ICurrentUser>();
        currentA.SetupGet(c => c.UserId).Returns(UserA);
        var ctlA = new FavoritesController(sharedRepo, ent.Object, currentA.Object, config);

        var currentB = new Mock<ICurrentUser>();
        currentB.SetupGet(c => c.UserId).Returns(UserB);
        var ctlB = new FavoritesController(sharedRepo, ent.Object, currentB.Object, config);

        // UserA creates a favorite
        var idForA = Guid.NewGuid();
        await ctlA.Create(NewRequest(idForA, "MineA"), CancellationToken.None);

        // UserB tries to update UserA's favorite — must get 404, not 200/403.
        var result = await ctlB.Update(idForA, new UpdateFavoriteRequest("Hijack", null, null, null), CancellationToken.None);

        result.Result.Should().BeOfType<NotFoundObjectResult>();
    }

    [Fact]
    public async Task Update_SoftDeleted_Returns404()
    {
        var (controller, repo) = Sut(UserA);
        var fav = Favorite.Create(Guid.NewGuid(), UserA, "X", null, null, null).Value!;
        await repo.AddAsync(fav);
        await repo.SaveChangesAsync();

        await controller.Delete(fav.Id, CancellationToken.None);   // soft delete

        var result = await controller.Update(fav.Id, new UpdateFavoriteRequest("Y", null, null, null), CancellationToken.None);
        result.Result.Should().BeOfType<NotFoundObjectResult>();
    }

    [Fact]
    public async Task Delete_Live_Returns204AndSetsDeletedAt()
    {
        var (controller, repo) = Sut(UserA);
        var fav = Favorite.Create(Guid.NewGuid(), UserA, "X", null, null, null).Value!;
        await repo.AddAsync(fav);
        await repo.SaveChangesAsync();

        var result = await controller.Delete(fav.Id, CancellationToken.None);

        result.Should().BeOfType<NoContentResult>();
        var stored = await repo.GetByIdForUserAsync(fav.Id, UserA);
        stored!.DeletedAt.Should().NotBeNull();
    }

    [Fact]
    public async Task Delete_AlreadyDeleted_Returns404()
    {
        var (controller, repo) = Sut(UserA);
        var fav = Favorite.Create(Guid.NewGuid(), UserA, "X", null, null, null).Value!;
        await repo.AddAsync(fav);
        await repo.SaveChangesAsync();

        await controller.Delete(fav.Id, CancellationToken.None);
        var second = await controller.Delete(fav.Id, CancellationToken.None);

        second.Should().BeOfType<NotFoundObjectResult>();
    }

    [Fact]
    public async Task GetAll_NoSince_ReturnsAllLive()
    {
        var (controller, _) = Sut(UserA);
        await controller.Create(NewRequest(name: "A"), CancellationToken.None);
        await controller.Create(NewRequest(name: "B"), CancellationToken.None);

        var result = await controller.GetAll(since: null, CancellationToken.None);
        var ok = result.Result.Should().BeOfType<OkObjectResult>().Subject;
        var body = ok.Value.Should().BeOfType<FavoritesSyncResponse>().Subject;

        body.Favorites.Should().HaveCount(2);
        body.Deletions.Should().BeEmpty();
        body.SyncedAt.Should().BeAfter(DateTime.UtcNow.AddMinutes(-1));
    }

    [Fact]
    public async Task GetAll_WithSince_FiltersAndIncludesDeletions()
    {
        var (controller, repo) = Sut(UserA);

        // Pre-cutoff records
        var oldFav = Favorite.Create(Guid.NewGuid(), UserA, "Old", null, null, null).Value!;
        await repo.AddAsync(oldFav);
        await repo.SaveChangesAsync();

        await Task.Delay(20);
        var cutoff = DateTime.UtcNow;
        await Task.Delay(20);

        // Post-cutoff: a new favorite + delete the old one
        var newFav = Favorite.Create(Guid.NewGuid(), UserA, "New", null, null, null).Value!;
        await repo.AddAsync(newFav);
        oldFav.SoftDelete();
        repo.Update(oldFav);
        await repo.SaveChangesAsync();

        var result = await controller.GetAll(since: cutoff, CancellationToken.None);
        var body = ((OkObjectResult)result.Result!).Value.Should().BeOfType<FavoritesSyncResponse>().Subject;

        body.Favorites.Should().ContainSingle().Which.DisplayName.Should().Be("New");
        body.Deletions.Should().ContainSingle().Which.Should().Be(oldFav.Id);
    }
}
```

- [ ] **Step 2: Run the tests**

Run from `backend/`:
```bash
dotnet test --filter "FullyQualifiedName~FavoritesControllerTests"
```
Expected: all 11 tests pass.

- [ ] **Step 3: Commit**

```bash
git add backend/Tests/Favorites/FavoritesControllerTests.cs
git commit -m "Add FavoritesController tests covering all endpoints and idempotency"
```

---

## Task 17: Tests — Entitlement cap edge cases

**Files:**
- Create: `backend/Tests/Favorites/EntitlementCapTests.cs`

- [ ] **Step 1: Create the tests**

Create `backend/Tests/Favorites/EntitlementCapTests.cs`:

```csharp
using Api.Controllers;
using Application.Common.Interfaces;
using Application.DTOs;
using Domain.Entities;
using FluentAssertions;
using Infrastructure.Repositories;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Configuration;
using Moq;
using Tests.Helpers;
using Xunit;

namespace Tests.Favorites;

public class EntitlementCapTests
{
    private static readonly Guid UserA = Guid.Parse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");

    private static (FavoritesController ctl, FavoriteRepository repo) Build(bool isPremium, int cap)
    {
        var ctx = TestDbContextFactory.Create();
        var repo = new FavoriteRepository(ctx);

        var ent = new Mock<IEntitlementRepository>();
        ent.Setup(e => e.IsPremiumAsync(It.IsAny<Guid>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(isPremium);

        var current = new Mock<ICurrentUser>();
        current.SetupGet(c => c.UserId).Returns(UserA);

        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?> { ["Premium:FreeFavoritesCap"] = cap.ToString() })
            .Build();

        return (new FavoritesController(repo, ent.Object, current.Object, config), repo);
    }

    private static async Task SeedFavoritesAsync(FavoriteRepository repo, int liveCount, int deletedCount = 0)
    {
        for (var i = 0; i < liveCount; i++)
        {
            var fav = Favorite.Create(Guid.NewGuid(), UserA, $"L{i}", null, null, null).Value!;
            await repo.AddAsync(fav);
        }
        for (var i = 0; i < deletedCount; i++)
        {
            var fav = Favorite.Create(Guid.NewGuid(), UserA, $"D{i}", null, null, null).Value!;
            fav.SoftDelete();
            await repo.AddAsync(fav);
        }
        await repo.SaveChangesAsync();
    }

    [Fact]
    public async Task PremiumUser_AtCap_CanCreateMore()
    {
        var (ctl, repo) = Build(isPremium: true, cap: 10);
        await SeedFavoritesAsync(repo, liveCount: 10);

        var req = new CreateFavoriteRequest(Guid.NewGuid(), "Eleventh", null, null, null);
        var result = await ctl.Create(req, CancellationToken.None);

        result.Result.Should().BeOfType<CreatedAtActionResult>();
    }

    [Fact]
    public async Task FreeUser_BelowCap_CanCreate()
    {
        var (ctl, repo) = Build(isPremium: false, cap: 10);
        await SeedFavoritesAsync(repo, liveCount: 9);

        var req = new CreateFavoriteRequest(Guid.NewGuid(), "Tenth", null, null, null);
        var result = await ctl.Create(req, CancellationToken.None);

        result.Result.Should().BeOfType<CreatedAtActionResult>();
    }

    [Fact]
    public async Task FreeUser_AtCap_GetsPaymentRequired()
    {
        var (ctl, repo) = Build(isPremium: false, cap: 10);
        await SeedFavoritesAsync(repo, liveCount: 10);

        var req = new CreateFavoriteRequest(Guid.NewGuid(), "Eleventh", null, null, null);
        var result = await ctl.Create(req, CancellationToken.None);

        var status = result.Result.Should().BeOfType<ObjectResult>().Subject;
        status.StatusCode.Should().Be(402);
    }

    [Fact]
    public async Task FreeUser_AtCap_WithSoftDeletes_LiveCountIsWhatMatters()
    {
        // Cap=10. User has 10 live + 5 soft-deleted. Should be at cap (deletes don't free a slot).
        var (ctl, repo) = Build(isPremium: false, cap: 10);
        await SeedFavoritesAsync(repo, liveCount: 10, deletedCount: 5);

        var req = new CreateFavoriteRequest(Guid.NewGuid(), "Eleventh", null, null, null);
        var result = await ctl.Create(req, CancellationToken.None);

        ((ObjectResult)result.Result!).StatusCode.Should().Be(402);
    }

    [Fact]
    public async Task FreeUser_OneSoftDeleted_LiveCountIsBelowCap()
    {
        // Cap=10. User has 9 live + 1 soft-deleted. Live count = 9, cap not hit.
        var (ctl, repo) = Build(isPremium: false, cap: 10);
        await SeedFavoritesAsync(repo, liveCount: 9, deletedCount: 1);

        var req = new CreateFavoriteRequest(Guid.NewGuid(), "Tenth", null, null, null);
        var result = await ctl.Create(req, CancellationToken.None);

        result.Result.Should().BeOfType<CreatedAtActionResult>();
    }

    [Fact]
    public async Task FreeUser_CapMessage_ContainsConfiguredCapValue()
    {
        var (ctl, repo) = Build(isPremium: false, cap: 7);   // Tunable: tests use cap=7 here
        await SeedFavoritesAsync(repo, liveCount: 7);

        var req = new CreateFavoriteRequest(Guid.NewGuid(), "Eighth", null, null, null);
        var result = await ctl.Create(req, CancellationToken.None);

        var status = (ObjectResult)result.Result!;
        status.StatusCode.Should().Be(402);
        var body = status.Value!.GetType().GetProperty("error")!.GetValue(status.Value)!.ToString();
        body.Should().Contain("7");
    }
}
```

- [ ] **Step 2: Run the tests**

Run from `backend/`:
```bash
dotnet test --filter "FullyQualifiedName~EntitlementCapTests"
```
Expected: all 6 tests pass.

- [ ] **Step 3: Run the full test suite to confirm no regressions in Plan 1 tests**

Run from `backend/`:
```bash
dotnet test
```
Expected: all tests pass (Plan 1's ~41 tests + Plan 2's new tests, ~75 total).

- [ ] **Step 4: Commit**

```bash
git add backend/Tests/Favorites/EntitlementCapTests.cs
git commit -m "Add entitlement cap edge-case tests"
```

---

## Task 18: README — document /api/favorites endpoint group

**Files:**
- Modify: `backend/README.md`

- [ ] **Step 1: Read the current README**

Read `backend/README.md`. Note the existing endpoints table (auth section) and where to insert the new section. The pattern from Plan 1 looked like:

```
## Auth Endpoints
| Method | Path | Auth | Body | Notes |
| --- | --- | --- | --- | --- |
| POST | /api/auth/anonymous | none | — | ... |
...
```

- [ ] **Step 2: Add a "Favorites Endpoints" section after the auth one**

Append (or insert under the auth table) the following block:

```markdown
## Favorites Endpoints

All require a JWT (anonymous or registered both work). Scoped to the authenticated user via the JWT's `sub` claim.

| Method | Path | Body | Notes |
| --- | --- | --- | --- |
| GET | `/api/favorites?since={iso8601}` | — | Returns `{ favorites, deletions, syncedAt }`. `since` optional; omit for full sync. |
| POST | `/api/favorites` | `{ id, displayName, nameDayKey?, birthdayDate?, relationship? }` | `id` is a client-generated UUID. Idempotent on `(userId, id)`. 402 when free-tier cap hit. 409 if `id` already used by another user. |
| PUT | `/api/favorites/{id}` | `{ displayName, nameDayKey?, birthdayDate?, relationship? }` | Full replace. 404 if not found / not owned / already deleted. |
| DELETE | `/api/favorites/{id}` | — | Soft delete (tombstone). Visible in subsequent `GET ?since=` responses' `deletions` array. |

`relationship` must be one of: `parent | child | sibling | spouse | grandparent | friend | colleague | other` (or null).

`nameDayKey` is an ASCII slug matching `^[a-z0-9-]{1,64}$`, or null.

Free tier: capped at the value of `Premium:FreeFavoritesCap` in `appsettings.json` (default `10`).
Cap is enforced server-side at `POST` via `IEntitlementRepository`. In Plan 2 the entitlement check is stubbed to always return "free"; a future plan replaces the stub with an Adapty-backed implementation.
```

- [ ] **Step 3: Commit**

```bash
git add backend/README.md
git commit -m "Document /api/favorites endpoint group in README"
```

---

## Task 19: End-to-end smoke test

This task verifies the full stack against a real Postgres (Supabase) instance.

**Files:** none new; runs against the live build.

- [ ] **Step 1: Apply the updated schema to Supabase**

The user's Supabase connection string is in `backend/Api/appsettings.Development.json` (gitignored). Use a Postgres client that respects UTF-8. From the project root:

If `psql` is installed:
```bash
psql "postgresql://postgres:<PASSWORD>@db.rrpubjcyimdulpkkufsx.supabase.co:5432/postgres" -f backend/database/create_tables.sql
```

If `psql` is not installed, use a Node fallback. Save the following as `apply-schema.mjs` in the repo root and run it once:

```js
// apply-schema.mjs — one-shot schema applier; deletes itself after success is optional.
import { readFileSync } from 'fs';
import pg from 'pg';

const conn = process.env.SUPABASE_CONN; // export this from appsettings.Development.json before running
if (!conn) { console.error('Set SUPABASE_CONN env var'); process.exit(1); }

const sql = readFileSync('backend/database/create_tables.sql', 'utf8');
const client = new pg.Client({ connectionString: conn, ssl: { rejectUnauthorized: false } });

await client.connect();
await client.query(sql);
console.log('Schema applied');
await client.end();
```

Install `pg` to a temp directory and run:
```bash
mkdir -p /tmp/pg-tmp && cd /tmp/pg-tmp && npm init -y && npm install pg
cd <project-root>
SUPABASE_CONN="postgresql://postgres:<PASSWORD>@db.rrpubjcyimdulpkkufsx.supabase.co:5432/postgres" \
  node --experimental-modules --input-type=module -e "$(cat apply-schema.mjs)"
```

Expected output: every `DROP TABLE` and `CREATE TABLE`/`CREATE INDEX` succeeds. The `Favorites` table is now present.

- [ ] **Step 2: Verify the schema applied**

Same connection, run:
```bash
psql "<conn>" -c "\d \"Favorites\""
```
Expected: column listing showing `Id`, `UserId`, `DisplayName`, `NameDayKey`, `BirthdayDate`, `Relationship`, `CreatedAt`, `UpdatedAt`, `DeletedAt`. Two indexes: `IX_Favorites_UserId_UpdatedAt` and `IX_Favorites_UserId_Live` (partial).

- [ ] **Step 3: Build and run the API**

From `backend/Api/`:
```bash
dotnet build
dotnet run --project Api/Api.csproj
```
Expected: API listens on `http://localhost:5233` (or whatever the launchSettings.json specifies).

- [ ] **Step 4: Smoke — anonymous create + add favorite + list**

In a separate terminal, from any directory. Replace `<TOKEN>` with the value returned from each step.

Create anonymous user:
```bash
curl -s -X POST http://localhost:5233/api/auth/anonymous | tee /tmp/anon.json
```
Save the `accessToken` field as `$TOKEN_A`.

Create a favorite:
```bash
NEW_ID=$(uuidgen)
curl -s -X POST http://localhost:5233/api/favorites \
  -H "Authorization: Bearer $TOKEN_A" \
  -H "Content-Type: application/json" \
  -d "{\"id\":\"$NEW_ID\",\"displayName\":\"Γιώργος\",\"nameDayKey\":\"giorgos\",\"birthdayDate\":\"1990-04-23\",\"relationship\":\"friend\"}"
```
Expected: 201 with the canonical record JSON.

List favorites:
```bash
curl -s -H "Authorization: Bearer $TOKEN_A" http://localhost:5233/api/favorites
```
Expected: 200 with `{ favorites: [<one record>], deletions: [], syncedAt: "..." }`.

- [ ] **Step 5: Smoke — cap enforcement**

Add favorites until the cap is hit. Loop nine more times (10 total in this account), then attempt an 11th:
```bash
for i in 2 3 4 5 6 7 8 9 10; do
  curl -s -X POST http://localhost:5233/api/favorites \
    -H "Authorization: Bearer $TOKEN_A" \
    -H "Content-Type: application/json" \
    -d "{\"id\":\"$(uuidgen)\",\"displayName\":\"Person $i\"}" >/dev/null
done

curl -s -i -X POST http://localhost:5233/api/favorites \
  -H "Authorization: Bearer $TOKEN_A" \
  -H "Content-Type: application/json" \
  -d "{\"id\":\"$(uuidgen)\",\"displayName\":\"Eleventh\"}"
```
Expected: the 11th call returns `HTTP/1.1 402 Payment Required` with `{"error":"Έχεις φτάσει το όριο των 10 αγαπημένων στη δωρεάν έκδοση."}`. (The body bytes are correct UTF-8; the Windows terminal may render them as mojibake — that's a console issue, not a server issue.)

- [ ] **Step 6: Smoke — claim flow preserves favorites**

Claim the anonymous account:
```bash
curl -s -X POST http://localhost:5233/api/auth/claim \
  -H "Authorization: Bearer $TOKEN_A" \
  -H "Content-Type: application/json" \
  -d '{"email":"smoketest+plan2@example.com","password":"plan2password"}' | tee /tmp/claimed.json
```
Save the new `accessToken` as `$TOKEN_R`.

List favorites with the registered token:
```bash
curl -s -H "Authorization: Bearer $TOKEN_R" http://localhost:5233/api/favorites
```
Expected: same 10 favorites are visible — UUIDs preserved across the claim transition because `userId` is preserved (Plan 1 design).

- [ ] **Step 7: Smoke — sync round-trip**

Capture syncedAt from the previous response. Then update a favorite and call GET with `?since=<syncedAt>`:
```bash
SOME_ID=<one of the favorite ids from step 6>
curl -s -X PUT "http://localhost:5233/api/favorites/$SOME_ID" \
  -H "Authorization: Bearer $TOKEN_R" \
  -H "Content-Type: application/json" \
  -d '{"displayName":"Renamed","nameDayKey":null,"birthdayDate":null,"relationship":null}'

curl -s -H "Authorization: Bearer $TOKEN_R" "http://localhost:5233/api/favorites?since=<syncedAt>"
```
Expected: `favorites` array contains exactly one record (the renamed one) with `displayName: "Renamed"`. `deletions` is empty.

Then delete a different favorite and re-query:
```bash
OTHER_ID=<a different favorite id>
curl -s -X DELETE "http://localhost:5233/api/favorites/$OTHER_ID" \
  -H "Authorization: Bearer $TOKEN_R"
curl -s -H "Authorization: Bearer $TOKEN_R" "http://localhost:5233/api/favorites?since=<syncedAt>"
```
Expected: `favorites` still includes the renamed one; `deletions` now contains `OTHER_ID`.

- [ ] **Step 8: Stop the API and commit (no code changes — this is verification only)**

If the smoke test surfaced any bugs, fix them and add a focused test. Otherwise no commit needed.

- [ ] **Step 9: Push the branch**

```bash
git push -u origin feature/plan-2-favorites-sync
```

Plan 2 complete.

---

## Acceptance summary

- ✅ All endpoints behave per design spec §5.
- ✅ Greek error messages render correctly in JSON UTF-8 (terminal display is a separate concern).
- ✅ `Favorites` table exists in Supabase with both indexes.
- ✅ Cap enforcement: 10 free, 402 on 11th, premium bypass works (verified via tests since stub always returns false).
- ✅ Soft delete: tombstones visible in `?since=` responses.
- ✅ Idempotency: duplicate `(userId, id)` returns existing record; cross-user collision returns 409.
- ✅ All Plan 1 tests still pass (no regressions).
- ✅ End-to-end smoke verified anonymous → favorites → claim → sync round-trip.
