using Domain.Entities;
using FluentAssertions;
using Xunit;

namespace Tests.Domain;

public class UserTests
{
    [Fact]
    public void CreateAnonymous_ProducesUser_WithIsAnonymousTrue_AndNoEmail()
    {
        var user = User.CreateAnonymous();
        user.IsAnonymous.Should().BeTrue();
        user.Email.Should().BeNull();
        user.PasswordHash.Should().BeNull();
        user.Id.Should().NotBe(Guid.Empty);
    }

    [Fact]
    public void Claim_AnonymousUser_SetsEmailAndMakesNotAnonymous()
    {
        var user = User.CreateAnonymous();
        var result = user.Claim("user@example.com", "hash123");
        result.IsSuccess.Should().BeTrue();
        user.IsAnonymous.Should().BeFalse();
        user.Email!.Value.Should().Be("user@example.com");
        user.PasswordHash.Should().Be("hash123");
    }

    [Fact]
    public void Claim_AlreadyClaimedUser_Fails()
    {
        var user = User.CreateAnonymous();
        user.Claim("user@example.com", "hash1");
        var result = user.Claim("other@example.com", "hash2");
        result.IsFailure.Should().BeTrue();
    }

    [Fact]
    public void CreateRegistered_ProducesUser_WithEmail_AndIsAnonymousFalse()
    {
        var result = User.CreateRegistered("user@example.com");
        result.IsSuccess.Should().BeTrue();
        var user = result.Value!;
        user.IsAnonymous.Should().BeFalse();
        user.Email!.Value.Should().Be("user@example.com");
    }

    [Fact]
    public void CreateRegistered_InvalidEmail_Fails()
    {
        var result = User.CreateRegistered("not-an-email");
        result.IsFailure.Should().BeTrue();
    }

    [Fact]
    public void SetPasswordHash_PersistsHash_AndUpdatesTimestamp()
    {
        var user = User.CreateRegistered("user@example.com").Value!;
        user.SetPasswordHash("bcrypt$hash$here");
        user.PasswordHash.Should().Be("bcrypt$hash$here");
        user.UpdatedAt.Should().NotBeNull();
    }

    [Fact]
    public void SetPasswordHash_EmptyHash_Throws()
    {
        var user = User.CreateRegistered("user@example.com").Value!;
        var act = () => user.SetPasswordHash("");
        act.Should().Throw<ArgumentException>();
    }
}
