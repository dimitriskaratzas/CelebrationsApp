using Application.Common.Interfaces;
using Application.DTOs;
using FluentAssertions;
using Infrastructure.Authentication;
using Infrastructure.Repositories;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Moq;
using Tests.Helpers;
using Xunit;

namespace Tests.Authentication;

public class AuthServiceTests
{
    private static AuthService CreateSut(out Mocks mocks)
    {
        var ctx = TestDbContextFactory.Create();
        var userRepo = new UserRepository(ctx);
        var refreshRepo = new RefreshTokenRepository(ctx);
        var resetRepo = new PasswordResetTokenRepository(ctx);

        var jwtOpts = Options.Create(new JwtSettings
        {
            Key = "this-is-a-test-key-with-at-least-32-chars-yes",
            Issuer = "test-issuer",
            Audience = "test-audience",
            AccessTokenMinutes = 15,
            RefreshTokenDays = 30,
        });

        var hasher = new BCryptPasswordHasher();
        var jwt = new JwtTokenService(jwtOpts);
        var emailMock = new Mock<IEmailService>();
        emailMock.Setup(e => e.SendPasswordResetAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()))
                 .Returns(Task.CompletedTask);
        var rateLimiter = new PasswordResetRateLimiter();

        mocks = new Mocks { Email = emailMock };
        return new AuthService(ctx, userRepo, refreshRepo, resetRepo, hasher, jwt, emailMock.Object, rateLimiter, jwtOpts);
    }

    private class Mocks { public Mock<IEmailService> Email { get; init; } = null!; }

    [Fact]
    public async Task CreateAnonymousAsync_ProducesUserAndTokens()
    {
        var sut = CreateSut(out _);
        var result = await sut.CreateAnonymousAsync();
        result.IsSuccess.Should().BeTrue();
        result.Value!.User.IsAnonymous.Should().BeTrue();
        result.Value.User.Email.Should().BeNull();
        result.Value.AccessToken.Should().NotBeNullOrEmpty();
        result.Value.RefreshToken.Should().NotBeNullOrEmpty();
    }

    [Fact]
    public async Task RegisterAsync_ValidEmailAndPassword_ProducesNonAnonymousUser()
    {
        var sut = CreateSut(out _);
        var result = await sut.RegisterAsync(new RegisterRequest("user@example.com", "password1"));
        result.IsSuccess.Should().BeTrue();
        result.Value!.User.IsAnonymous.Should().BeFalse();
        result.Value.User.Email.Should().Be("user@example.com");
    }

    [Theory]
    [InlineData("short")]            // < 8 chars
    [InlineData("nodigitshere")]     // no digit
    [InlineData("12345678")]          // no letter
    public async Task RegisterAsync_InvalidPassword_Fails(string password)
    {
        var sut = CreateSut(out _);
        var result = await sut.RegisterAsync(new RegisterRequest("user@example.com", password));
        result.IsFailure.Should().BeTrue();
    }

    [Fact]
    public async Task RegisterAsync_DuplicateEmail_Fails()
    {
        var sut = CreateSut(out _);
        await sut.RegisterAsync(new RegisterRequest("user@example.com", "password1"));
        var second = await sut.RegisterAsync(new RegisterRequest("user@example.com", "password2"));
        second.IsFailure.Should().BeTrue();
        second.Error.Should().Contain("Υπάρχει ήδη");
    }

    [Fact]
    public async Task ClaimAnonymousAsync_PromotesAnonymousToRegistered()
    {
        var sut = CreateSut(out _);
        var anon = await sut.CreateAnonymousAsync();
        var anonId = anon.Value!.User.Id;

        var claim = await sut.ClaimAnonymousAsync(anonId, new AnonymousClaimRequest("user@example.com", "password1"));
        claim.IsSuccess.Should().BeTrue();
        claim.Value!.User.IsAnonymous.Should().BeFalse();
        claim.Value.User.Email.Should().Be("user@example.com");
        claim.Value.User.Id.Should().Be(anonId);   // same row, just promoted
    }

    [Fact]
    public async Task ClaimAnonymousAsync_NonAnonymousUser_Fails()
    {
        var sut = CreateSut(out _);
        var registered = await sut.RegisterAsync(new RegisterRequest("user@example.com", "password1"));
        var result = await sut.ClaimAnonymousAsync(
            registered.Value!.User.Id,
            new AnonymousClaimRequest("other@example.com", "password2"));
        result.IsFailure.Should().BeTrue();
    }

    [Fact]
    public async Task LoginAsync_CorrectCredentials_Succeeds()
    {
        var sut = CreateSut(out _);
        await sut.RegisterAsync(new RegisterRequest("user@example.com", "password1"));
        var login = await sut.LoginAsync(new LoginRequest("user@example.com", "password1"));
        login.IsSuccess.Should().BeTrue();
    }

    [Fact]
    public async Task LoginAsync_WrongPassword_Fails()
    {
        var sut = CreateSut(out _);
        await sut.RegisterAsync(new RegisterRequest("user@example.com", "password1"));
        var login = await sut.LoginAsync(new LoginRequest("user@example.com", "wrongpwd1"));
        login.IsFailure.Should().BeTrue();
    }

    [Fact]
    public async Task LoginAsync_UnknownEmail_Fails()
    {
        var sut = CreateSut(out _);
        var login = await sut.LoginAsync(new LoginRequest("nobody@example.com", "password1"));
        login.IsFailure.Should().BeTrue();
    }

    [Fact]
    public async Task RefreshAsync_ValidToken_RotatesAndIssuesNewPair()
    {
        var sut = CreateSut(out _);
        var registered = await sut.RegisterAsync(new RegisterRequest("user@example.com", "password1"));
        var oldRefresh = registered.Value!.RefreshToken;

        var refresh = await sut.RefreshAsync(new RefreshRequest(oldRefresh));
        refresh.IsSuccess.Should().BeTrue();
        refresh.Value!.RefreshToken.Should().NotBe(oldRefresh);

        // Old refresh now revoked → reusing it must fail.
        var reuse = await sut.RefreshAsync(new RefreshRequest(oldRefresh));
        reuse.IsFailure.Should().BeTrue();
    }

    [Fact]
    public async Task ForgotPassword_KnownUser_CallsEmailService()
    {
        var sut = CreateSut(out var mocks);
        await sut.RegisterAsync(new RegisterRequest("user@example.com", "password1"));
        await sut.ForgotPasswordAsync(new ForgotPasswordRequest("user@example.com"));

        mocks.Email.Verify(e => e.SendPasswordResetAsync(
            It.Is<string>(s => s == "user@example.com"),
            It.IsAny<string>(),
            It.IsAny<CancellationToken>()),
            Times.Once);
    }

    [Fact]
    public async Task ForgotPassword_UnknownUser_DoesNotCallEmailService()
    {
        var sut = CreateSut(out var mocks);
        await sut.ForgotPasswordAsync(new ForgotPasswordRequest("nobody@example.com"));
        mocks.Email.Verify(e => e.SendPasswordResetAsync(
            It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()),
            Times.Never);
    }
}
