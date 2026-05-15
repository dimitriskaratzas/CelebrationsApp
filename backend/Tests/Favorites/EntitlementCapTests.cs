using Api.Controllers;
using Application.Common;
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

        return (new FavoritesController(repo, ent.Object, current.Object, ctx, config), repo);
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
    public async Task FreeUser_AtCap_GetsForbiddenWithCode()
    {
        var (ctl, repo) = Build(isPremium: false, cap: 10);
        await SeedFavoritesAsync(repo, liveCount: 10);

        var req = new CreateFavoriteRequest(Guid.NewGuid(), "Eleventh", null, null, null);
        var result = await ctl.Create(req, CancellationToken.None);

        var status = result.Result.Should().BeOfType<ObjectResult>().Subject;
        status.StatusCode.Should().Be(403);
        var problem = status.Value.Should().BeOfType<ProblemDetails>().Subject;
        problem.Extensions["code"].Should().Be(ErrorCodes.FreeTierCap);
    }

    [Fact]
    public async Task FreeUser_AtCap_WithSoftDeletes_LiveCountIsWhatMatters()
    {
        // Cap=10. User has 10 live + 5 soft-deleted. Should be at cap (deletes don't free a slot).
        var (ctl, repo) = Build(isPremium: false, cap: 10);
        await SeedFavoritesAsync(repo, liveCount: 10, deletedCount: 5);

        var req = new CreateFavoriteRequest(Guid.NewGuid(), "Eleventh", null, null, null);
        var result = await ctl.Create(req, CancellationToken.None);

        ((ObjectResult)result.Result!).StatusCode.Should().Be(403);
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
        status.StatusCode.Should().Be(403);
        var problem = status.Value.Should().BeOfType<ProblemDetails>().Subject;
        problem.Title.Should().Contain("7");
        problem.Extensions["limit"].Should().Be(7);
    }
}
