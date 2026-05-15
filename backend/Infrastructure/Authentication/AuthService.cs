using System.Data;
using System.Security.Cryptography;
using System.Text.RegularExpressions;
using Application.Common;
using Application.Common.Interfaces;
using Application.DTOs;
using Application.Mapping;
using Domain.Common;
using Domain.Entities;
using Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;
using Microsoft.Extensions.Options;
using Npgsql;

namespace Infrastructure.Authentication;

public partial class AuthService(
    AppDbContext dbContext,
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
    private const string InvalidCredentialsMessage = "Λανθασμένο email ή κωδικός.";
    private const string UniqueViolationSqlState = "23505";

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
        if (validation.IsFailure) return Result.Failure<AuthResult>(ErrorCodes.Validation, validation.Error);

        // Fast path: most duplicates are caught here. Race-safe fallback is the 23505 catch below.
        if (await userRepo.ExistsWithEmailAsync(request.Email, ct))
            return Result.Failure<AuthResult>(ErrorCodes.EmailTaken, "Υπάρχει ήδη λογαριασμός με αυτό το email.");

        var userResult = User.CreateRegistered(request.Email);
        if (userResult.IsFailure) return Result.Failure<AuthResult>(ErrorCodes.Validation, userResult.Error);

        var user = userResult.Value!;
        user.SetPasswordHash(passwordHasher.Hash(request.Password));

        await using IDbContextTransaction? tx =
            await dbContext.Database.BeginTransactionIfRelationalAsync(ct);
        try
        {
            await userRepo.AddAsync(user, ct);
            await userRepo.SaveChangesAsync(ct);
        }
        catch (DbUpdateException ex) when (IsUniqueViolation(ex))
        {
            await tx.RollbackIfPresentAsync(ct);
            return Result.Failure<AuthResult>(ErrorCodes.EmailTaken, "Υπάρχει ήδη λογαριασμός με αυτό το email.");
        }

        var tokens = await IssueTokensAsync(user, ct);
        await tx.CommitIfPresentAsync(ct);

        return Result.Success(new AuthResult(
            tokens.Access, tokens.Refresh, tokens.AccessExpiresAt, UserMapping.ToDto(user)));
    }

    public async Task<Result<AuthResult>> ClaimAnonymousAsync(Guid anonymousUserId, AnonymousClaimRequest request, CancellationToken ct = default)
    {
        var validation = ValidatePassword(request.Password);
        if (validation.IsFailure) return Result.Failure<AuthResult>(ErrorCodes.Validation, validation.Error);

        var user = await userRepo.GetByIdAsync(anonymousUserId, ct);
        if (user is null) return Result.Failure<AuthResult>(ErrorCodes.UserNotFound, "Ο χρήστης δεν βρέθηκε.");
        if (!user.IsAnonymous) return Result.Failure<AuthResult>(ErrorCodes.UserAlreadyRegistered, "Ο χρήστης είναι ήδη εγγεγραμμένος.");

        // Fast path: race-safe fallback is the 23505 catch below.
        if (await userRepo.ExistsWithEmailAsync(request.Email, ct))
            return Result.Failure<AuthResult>(ErrorCodes.EmailTaken, "Υπάρχει ήδη λογαριασμός με αυτό το email.");

        var claimResult = user.Claim(request.Email, passwordHasher.Hash(request.Password));
        if (claimResult.IsFailure) return Result.Failure<AuthResult>(ErrorCodes.Validation, claimResult.Error);

        // Claim + revoke-old-tokens + issue-new-tokens must be atomic.
        await using IDbContextTransaction? tx =
            await dbContext.Database.BeginTransactionIfRelationalAsync(ct);
        try
        {
            await userRepo.SaveChangesAsync(ct);
            await refreshRepo.RevokeAllForUserAsync(user.Id, ct);
            var tokens = await IssueTokensAsync(user, ct);
            await tx.CommitIfPresentAsync(ct);

            return Result.Success(new AuthResult(
                tokens.Access, tokens.Refresh, tokens.AccessExpiresAt, UserMapping.ToDto(user)));
        }
        catch (DbUpdateException ex) when (IsUniqueViolation(ex))
        {
            await tx.RollbackIfPresentAsync(ct);
            return Result.Failure<AuthResult>(ErrorCodes.EmailTaken, "Υπάρχει ήδη λογαριασμός με αυτό το email.");
        }
    }

    public async Task<Result<AuthResult>> LoginAsync(LoginRequest request, CancellationToken ct = default)
    {
        var user = await userRepo.GetByEmailAsync(request.Email, ct);
        if (user is null || string.IsNullOrEmpty(user.PasswordHash))
            return Result.Failure<AuthResult>(ErrorCodes.InvalidCredentials, InvalidCredentialsMessage);

        if (!passwordHasher.Verify(request.Password, user.PasswordHash))
            return Result.Failure<AuthResult>(ErrorCodes.InvalidCredentials, InvalidCredentialsMessage);

        var tokens = await IssueTokensAsync(user, ct);
        return Result.Success(new AuthResult(
            tokens.Access, tokens.Refresh, tokens.AccessExpiresAt, UserMapping.ToDto(user)));
    }

    public async Task<Result<RefreshResult>> RefreshAsync(RefreshRequest request, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(request.RefreshToken))
            return Result.Failure<RefreshResult>(ErrorCodes.InvalidRefreshToken, "Refresh token is required.");

        var tokenHash = Hash(request.RefreshToken);
        var existing = await refreshRepo.GetByTokenHashAsync(tokenHash, ct);
        if (existing is null)
            return Result.Failure<RefreshResult>(ErrorCodes.InvalidRefreshToken, "Invalid or expired refresh token.");

        // Race-safe revoke: conditional UPDATE that wins exactly one concurrent attempt.
        // If RowCount is 0, either (a) the token has already been revoked / expired (normal expired
        // session — return generic invalid) or (b) someone else just rotated it (token reuse — revoke
        // the entire user's refresh family).
        var now = DateTime.UtcNow;
        int revokedRows;
        if (dbContext.Database.IsRelational())
        {
            revokedRows = await dbContext.RefreshTokens
                .Where(t => t.Id == existing.Id && t.RevokedAt == null && t.ExpiresAt > now)
                .ExecuteUpdateAsync(s => s.SetProperty(t => t.RevokedAt, now), ct);
        }
        else
        {
            // Non-relational test path. Same semantic, not race-safe — relies on the IsActive check.
            if (existing.IsActive)
            {
                existing.Revoke();
                await refreshRepo.SaveChangesAsync(ct);
                revokedRows = 1;
            }
            else
            {
                revokedRows = 0;
            }
        }

        if (revokedRows == 0)
        {
            // Inspect: was the row simply already revoked (race with a logout, or expired)
            // or was it revoked by a *previous successful rotation* (reuse)? If the original
            // token was revoked AFTER it was first presented, that's reuse-after-rotation.
            if (existing.RevokedAt is not null)
            {
                await refreshRepo.RevokeAllForUserAsync(existing.UserId, ct);
                return Result.Failure<RefreshResult>(ErrorCodes.RefreshTokenReused,
                    "Refresh token reuse detected. All sessions revoked.");
            }
            return Result.Failure<RefreshResult>(ErrorCodes.InvalidRefreshToken, "Invalid or expired refresh token.");
        }

        var user = await userRepo.GetByIdAsync(existing.UserId, ct);
        if (user is null) return Result.Failure<RefreshResult>(ErrorCodes.UserNotFound, "User not found.");

        var tokens = await IssueTokensAsync(user, ct);
        return Result.Success(new RefreshResult(tokens.Access, tokens.Refresh, tokens.AccessExpiresAt));
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
            return Result.Failure(ErrorCodes.InvalidResetToken, "Μη έγκυρος σύνδεσμος επαναφοράς.");

        var validation = ValidatePassword(request.NewPassword);
        if (validation.IsFailure) return Result.Failure(ErrorCodes.Validation, validation.Error);

        var entity = await resetRepo.GetByTokenHashAsync(Hash(request.Token), ct);
        if (entity is null || !entity.IsActive)
            return Result.Failure(ErrorCodes.InvalidResetToken, "Ο σύνδεσμος επαναφοράς δεν είναι έγκυρος ή έχει λήξει.");

        var user = await userRepo.GetByIdAsync(entity.UserId, ct);
        if (user is null) return Result.Failure(ErrorCodes.UserNotFound, "Ο χρήστης δεν βρέθηκε.");

        await using IDbContextTransaction? tx =
            await dbContext.Database.BeginTransactionIfRelationalAsync(ct);
        user.SetPasswordHash(passwordHasher.Hash(request.NewPassword));
        entity.MarkUsed();
        await refreshRepo.RevokeAllForUserAsync(user.Id, ct);
        await dbContext.SaveChangesAsync(ct);
        await tx.CommitIfPresentAsync(ct);

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

    private static bool IsUniqueViolation(DbUpdateException ex) =>
        ex.InnerException is PostgresException pg && pg.SqlState == UniqueViolationSqlState;

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
