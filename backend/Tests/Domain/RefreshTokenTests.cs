using Domain.Entities;
using FluentAssertions;
using Xunit;

namespace Tests.Domain;

public class RefreshTokenTests
{
    [Fact]
    public void Create_NewToken_IsActive()
    {
        var t = RefreshToken.Create(Guid.NewGuid(), "hash", DateTime.UtcNow.AddDays(30));
        t.IsActive.Should().BeTrue();
        t.RevokedAt.Should().BeNull();
    }

    [Fact]
    public void Create_AlreadyExpiredToken_IsNotActive()
    {
        var t = RefreshToken.Create(Guid.NewGuid(), "hash", DateTime.UtcNow.AddSeconds(-1));
        t.IsActive.Should().BeFalse();
    }

    [Fact]
    public void Revoke_SetsRevokedAt_AndDeactivates()
    {
        var t = RefreshToken.Create(Guid.NewGuid(), "hash", DateTime.UtcNow.AddDays(30));
        t.Revoke();
        t.IsActive.Should().BeFalse();
        t.RevokedAt.Should().NotBeNull();
    }

    [Fact]
    public void Revoke_AlreadyRevoked_IsIdempotent()
    {
        var t = RefreshToken.Create(Guid.NewGuid(), "hash", DateTime.UtcNow.AddDays(30));
        t.Revoke();
        var firstRevocation = t.RevokedAt;
        t.Revoke();
        t.RevokedAt.Should().Be(firstRevocation);
    }
}
