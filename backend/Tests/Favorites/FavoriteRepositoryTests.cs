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
