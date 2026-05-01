using System.Security.Cryptography;
using System.Text.RegularExpressions;
using Application.Common.Interfaces;
using Application.DTOs;
using Application.Mapping;
using Domain.Common;
using Domain.Entities;
using Microsoft.Extensions.Options;

namespace Infrastructure.Authentication;

public partial class AuthService(
    IUserRepository userRepo,
    IRefreshTokenRepository refreshRepo,
    IPasswordResetTokenRepository resetRepo,
    IPasswordHasher passwordHasher,
    IJwtTokenService jwt,
    IEmailService emailService,
    PasswordResetRateLimiter rateLimiter,
    IOptions<JwtSettings> jwtOptions) : IAuthService
{
    private readonly JwtSettings _jwt = jwtOptions.Value;
    private const string ResetDeepLinkBase = "celebrations://reset-password?token=";
    private const string InvalidCredentials = "Λανθασμένο email ή κωδικός.";

    public async Task<Result<AuthResult>> CreateAnonymousAsync(CancellationToken ct = default)
    {
        var user = User.CreateAnonymous();
        await userRepo.AddAsync(user, ct);
        await userRepo.SaveChangesAsync(ct);

        var tokens = await IssueTokensAsync(user, ct);
        return Result.Success(new AuthResult(
            tokens.Access, tokens.Refresh, tokens.AccessExpiresAt, UserMapping.ToDto(user)));
    }

    public async Task<Result<AuthResult>> RegisterAsync(RegisterRequest request, CancellationToken ct = default)
    {
        var validation = ValidatePassword(request.Password);
        if (validation.IsFailure) return Result.Failure<AuthResult>(validation.Error);

        if (await userRepo.ExistsWithEmailAsync(request.Email, ct))
            return Result.Failure<AuthResult>("Υπάρχει ήδη λογαριασμός με αυτό το email.");

        var userResult = User.CreateRegistered(request.Email);
        if (userResult.IsFailure) return Result.Failure<AuthResult>(userResult.Error);

        var user = userResult.Value!;
        user.SetPasswordHash(passwordHasher.Hash(request.Password));

        await userRepo.AddAsync(user, ct);
        await userRepo.SaveChangesAsync(ct);

        var tokens = await IssueTokensAsync(user, ct);
        return Result.Success(new AuthResult(
            tokens.Access, tokens.Refresh, tokens.AccessExpiresAt, UserMapping.ToDto(user)));
    }

    public async Task<Result<AuthResult>> ClaimAnonymousAsync(Guid anonymousUserId, AnonymousClaimRequest request, CancellationToken ct = default)
    {
        var validation = ValidatePassword(request.Password);
        if (validation.IsFailure) return Result.Failure<AuthResult>(validation.Error);

        var user = await userRepo.GetByIdAsync(anonymousUserId, ct);
        if (user is null) return Result.Failure<AuthResult>("Ο χρήστης δεν βρέθηκε.");
        if (!user.IsAnonymous) return Result.Failure<AuthResult>("Ο χρήστης είναι ήδη εγγεγραμμένος.");

        if (await userRepo.ExistsWithEmailAsync(request.Email, ct))
            return Result.Failure<AuthResult>("Υπάρχει ήδη λογαριασμός με αυτό το email.");

        var claimResult = user.Claim(request.Email, passwordHasher.Hash(request.Password));
        if (claimResult.IsFailure) return Result.Failure<AuthResult>(claimResult.Error);

        // TODO(Phase 1.1): Wrap claim + revoke + issue in a single transaction (or single SaveChanges).
        // Today these are two DB transactions; if the process dies between them, old anonymous refresh
        // tokens remain active in the DB until they expire.
        await userRepo.SaveChangesAsync(ct);

        // Revoke all refresh tokens issued under the anonymous identity, and issue
        // a fresh pair under the now-registered identity.
        await refreshRepo.RevokeAllForUserAsync(user.Id, ct);
        var tokens = await IssueTokensAsync(user, ct);
        return Result.Success(new AuthResult(
            tokens.Access, tokens.Refresh, tokens.AccessExpiresAt, UserMapping.ToDto(user)));
    }

    public async Task<Result<AuthResult>> LoginAsync(LoginRequest request, CancellationToken ct = default)
    {
        var user = await userRepo.GetByEmailAsync(request.Email, ct);
        if (user is null || string.IsNullOrEmpty(user.PasswordHash))
            return Result.Failure<AuthResult>(InvalidCredentials);

        if (!passwordHasher.Verify(request.Password, user.PasswordHash))
            return Result.Failure<AuthResult>(InvalidCredentials);

        var tokens = await IssueTokensAsync(user, ct);
        return Result.Success(new AuthResult(
            tokens.Access, tokens.Refresh, tokens.AccessExpiresAt, UserMapping.ToDto(user)));
    }

    public async Task<Result<RefreshResult>> RefreshAsync(RefreshRequest request, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(request.RefreshToken))
            return Result.Failure<RefreshResult>("Refresh token is required.");

        var existing = await refreshRepo.GetByTokenHashAsync(Hash(request.RefreshToken), ct);
        if (existing is null || !existing.IsActive)
            return Result.Failure<RefreshResult>("Invalid or expired refresh token.");

        var user = await userRepo.GetByIdAsync(existing.UserId, ct);
        if (user is null) return Result.Failure<RefreshResult>("User not found.");

        // Rotate: revoke the presented refresh and issue a new pair. If the same
        // refresh is reused after rotation, the IsActive check above will reject it.
        // TODO(Phase 1.1): Make rotation race-safe (e.g., row version or SELECT ... FOR UPDATE).
        // Two concurrent refreshes could each pass the IsActive check before either persists revocation.
        existing.Revoke();
        var tokens = await IssueTokensAsync(user, ct);
        return Result.Success(new RefreshResult(
            tokens.Access, tokens.Refresh, tokens.AccessExpiresAt));
    }

    public async Task<Result> LogoutAsync(LogoutRequest request, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(request.RefreshToken))
            return Result.Success();

        var existing = await refreshRepo.GetByTokenHashAsync(Hash(request.RefreshToken), ct);
        if (existing is not null && existing.RevokedAt is null)
        {
            existing.Revoke();
            await refreshRepo.SaveChangesAsync(ct);
        }
        return Result.Success();
    }

    public async Task<Result> ForgotPasswordAsync(ForgotPasswordRequest request, CancellationToken ct = default)
    {
        // Always return success so an attacker can't enumerate registered emails.
        if (string.IsNullOrWhiteSpace(request.Email)) return Result.Success();
        if (!rateLimiter.TryRecord(request.Email)) return Result.Success();

        var user = await userRepo.GetByEmailAsync(request.Email.Trim(), ct);
        if (user is null) return Result.Success();

        await resetRepo.RevokeAllForUserAsync(user.Id, ct);

        var rawToken = GenerateSecureToken();
        var entity = PasswordResetToken.Create(user.Id, Hash(rawToken), DateTime.UtcNow.AddHours(1));
        await resetRepo.AddAsync(entity, ct);
        await resetRepo.SaveChangesAsync(ct);

        var link = ResetDeepLinkBase + Uri.EscapeDataString(rawToken);
        await emailService.SendPasswordResetAsync(request.Email.Trim(), link, ct);

        return Result.Success();
    }

    public async Task<Result> ResetPasswordAsync(ResetPasswordRequest request, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(request.Token))
            return Result.Failure("Μη έγκυρος σύνδεσμος επαναφοράς.");

        var validation = ValidatePassword(request.NewPassword);
        if (validation.IsFailure) return validation;

        var entity = await resetRepo.GetByTokenHashAsync(Hash(request.Token), ct);
        if (entity is null || !entity.IsActive)
            return Result.Failure("Ο σύνδεσμος επαναφοράς δεν είναι έγκυρος ή έχει λήξει.");

        var user = await userRepo.GetByIdAsync(entity.UserId, ct);
        if (user is null) return Result.Failure("Ο χρήστης δεν βρέθηκε.");

        user.SetPasswordHash(passwordHasher.Hash(request.NewPassword));
        entity.MarkUsed();
        await refreshRepo.RevokeAllForUserAsync(user.Id, ct);

        await userRepo.SaveChangesAsync(ct);
        return Result.Success();
    }

    private async Task<(string Access, string Refresh, DateTime AccessExpiresAt)> IssueTokensAsync(User user, CancellationToken ct)
    {
        var (accessToken, accessExpires) = jwt.Issue(user);

        var refreshRaw = GenerateRefreshToken();
        var refreshEntity = RefreshToken.Create(
            user.Id,
            Hash(refreshRaw),
            DateTime.UtcNow.AddDays(_jwt.RefreshTokenDays));

        await refreshRepo.AddAsync(refreshEntity, ct);
        await refreshRepo.SaveChangesAsync(ct);

        return (accessToken, refreshRaw, accessExpires);
    }

    private static string GenerateSecureToken() =>
        Convert.ToBase64String(RandomNumberGenerator.GetBytes(32));

    private static string GenerateRefreshToken() =>
        Convert.ToBase64String(RandomNumberGenerator.GetBytes(32));

    private static string Hash(string token)
    {
        var bytes = System.Text.Encoding.UTF8.GetBytes(token);
        return Convert.ToHexString(SHA256.HashData(bytes));
    }

    private static Result ValidatePassword(string password)
    {
        if (string.IsNullOrEmpty(password) || password.Length < 8)
            return Result.Failure("Ο κωδικός πρέπει να έχει τουλάχιστον 8 χαρακτήρες.");
        if (!HasLetter().IsMatch(password))
            return Result.Failure("Ο κωδικός πρέπει να περιέχει τουλάχιστον ένα γράμμα.");
        if (!HasDigit().IsMatch(password))
            return Result.Failure("Ο κωδικός πρέπει να περιέχει τουλάχιστον έναν αριθμό.");
        return Result.Success();
    }

    [GeneratedRegex(@"\p{L}")]
    private static partial Regex HasLetter();

    [GeneratedRegex(@"\d")]
    private static partial Regex HasDigit();
}
