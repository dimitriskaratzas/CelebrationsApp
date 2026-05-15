using Application.Common;
using Application.Common.Interfaces;
using Application.DTOs;
using Domain.Common;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Api.Controllers;

[ApiController]
[Route("api/auth")]
public class AuthController(IAuthService authService, ICurrentUser currentUser) : ControllerBase
{
    [HttpPost("anonymous")]
    [AllowAnonymous]
    public async Task<ActionResult<AuthResult>> CreateAnonymous(CancellationToken ct)
    {
        var result = await authService.CreateAnonymousAsync(ct);
        if (result.IsFailure) return MapFailure<AuthResult>(result);
        return Ok(result.Value);
    }

    [HttpPost("register")]
    [AllowAnonymous]
    public async Task<ActionResult<AuthResult>> Register([FromBody] RegisterRequest request, CancellationToken ct)
    {
        var result = await authService.RegisterAsync(request, ct);
        if (result.IsFailure) return MapFailure<AuthResult>(result);
        return Ok(result.Value);
    }

    [HttpPost("claim")]
    [Authorize]
    public async Task<ActionResult<AuthResult>> ClaimAnonymous([FromBody] AnonymousClaimRequest request, CancellationToken ct)
    {
        if (currentUser.UserId is not Guid userId) return Unauthorized();
        if (!currentUser.IsAnonymous)
            return ProblemDetailsError(StatusCodes.Status400BadRequest,
                ErrorCodes.UserAlreadyRegistered, "Ο χρήστης είναι ήδη εγγεγραμμένος.");

        var result = await authService.ClaimAnonymousAsync(userId, request, ct);
        if (result.IsFailure) return MapFailure<AuthResult>(result);
        return Ok(result.Value);
    }

    [HttpPost("login")]
    [AllowAnonymous]
    public async Task<ActionResult<AuthResult>> Login([FromBody] LoginRequest request, CancellationToken ct)
    {
        var result = await authService.LoginAsync(request, ct);
        if (result.IsFailure) return MapFailure<AuthResult>(result);
        return Ok(result.Value);
    }

    [HttpPost("refresh")]
    [AllowAnonymous]
    public async Task<ActionResult<RefreshResult>> Refresh([FromBody] RefreshRequest request, CancellationToken ct)
    {
        var result = await authService.RefreshAsync(request, ct);
        if (result.IsFailure) return MapFailure<RefreshResult>(result);
        return Ok(result.Value);
    }

    [HttpPost("logout")]
    [AllowAnonymous]
    public async Task<ActionResult> Logout([FromBody] LogoutRequest request, CancellationToken ct)
    {
        await authService.LogoutAsync(request, ct);
        return NoContent();
    }

    [HttpPost("forgot-password")]
    [AllowAnonymous]
    public async Task<ActionResult> ForgotPassword([FromBody] ForgotPasswordRequest request, CancellationToken ct)
    {
        await authService.ForgotPasswordAsync(request, ct);
        return Ok(new { message = "Αν το email υπάρχει, θα λάβεις σύνδεσμο επαναφοράς." });
    }

    [HttpPost("reset-password")]
    [AllowAnonymous]
    public async Task<ActionResult> ResetPassword([FromBody] ResetPasswordRequest request, CancellationToken ct)
    {
        var result = await authService.ResetPasswordAsync(request, ct);
        if (result.IsFailure)
        {
            var status = result.ErrorCode == ErrorCodes.InvalidResetToken
                ? StatusCodes.Status400BadRequest
                : StatusCodes.Status400BadRequest;
            return ProblemDetailsError(status, result.ErrorCode, result.Error);
        }
        return Ok(new { message = "Ο κωδικός άλλαξε επιτυχώς." });
    }

    private ActionResult<T> MapFailure<T>(Result result)
    {
        var status = result.ErrorCode switch
        {
            ErrorCodes.EmailTaken => StatusCodes.Status409Conflict,
            ErrorCodes.UserAlreadyRegistered => StatusCodes.Status400BadRequest,
            ErrorCodes.UserNotFound => StatusCodes.Status404NotFound,
            ErrorCodes.InvalidCredentials => StatusCodes.Status401Unauthorized,
            ErrorCodes.InvalidRefreshToken => StatusCodes.Status401Unauthorized,
            ErrorCodes.RefreshTokenReused => StatusCodes.Status401Unauthorized,
            ErrorCodes.InvalidResetToken => StatusCodes.Status400BadRequest,
            ErrorCodes.Validation => StatusCodes.Status400BadRequest,
            _ => StatusCodes.Status400BadRequest,
        };
        return ProblemDetailsError(status, result.ErrorCode, result.Error);
    }

    private ObjectResult ProblemDetailsError(int status, string code, string message)
    {
        var details = new ProblemDetails
        {
            Status = status,
            Title = message,
            Type = $"about:blank#{code}",
        };
        details.Extensions["code"] = string.IsNullOrEmpty(code) ? "ERROR" : code;
        return StatusCode(status, details);
    }
}
