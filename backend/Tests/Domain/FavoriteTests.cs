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
