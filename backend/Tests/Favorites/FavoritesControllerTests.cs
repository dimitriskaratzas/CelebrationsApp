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
        // Shared context so both controllers see the same row.
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

        var id = Guid.NewGuid();
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
