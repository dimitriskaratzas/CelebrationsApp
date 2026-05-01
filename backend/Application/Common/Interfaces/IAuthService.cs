using Application.DTOs;
using Domain.Common;

namespace Application.Common.Interfaces;

public interface IAuthService
{
    // Creates a new anonymous user (no email/password). Returns issued tokens.
    Task<Result<AuthResult>> CreateAnonymousAsync(CancellationToken ct = default);

    // Standard email/password registration. Creates a fresh non-anonymous user.
    Task<Result<AuthResult>> RegisterAsync(RegisterRequest request, CancellationToken ct = default);

    // Promotes an existing anonymous user (identified by their JWT) to registered
    // by setting email + password. Used when a "Skip for now" user later signs up.
    Task<Result<AuthResult>> ClaimAnonymousAsync(Guid anonymousUserId, AnonymousClaimRequest request, CancellationToken ct = default);

    Task<Result<AuthResult>> LoginAsync(LoginRequest request, CancellationToken ct = default);
    Task<Result<RefreshResult>> RefreshAsync(RefreshRequest request, CancellationToken ct = default);
    Task<Result> LogoutAsync(LogoutRequest request, CancellationToken ct = default);
    Task<Result> ForgotPasswordAsync(ForgotPasswordRequest request, CancellationToken ct = default);
    Task<Result> ResetPasswordAsync(ResetPasswordRequest request, CancellationToken ct = default);
}
