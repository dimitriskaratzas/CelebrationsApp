using Application.Common.Interfaces;
using Application.DTOs;
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
        if (result.IsFailure) return BadRequest(new { error = result.Error });
        return Ok(result.Value);
    }

    [HttpPost("register")]
    [AllowAnonymous]
    public async Task<ActionResult<AuthResult>> Register([FromBody] RegisterRequest request, CancellationToken ct)
    {
        var result = await authService.RegisterAsync(request, ct);
        if (result.IsFailure)
        {
            if (result.Error.StartsWith("Υπάρχει ήδη"))
                return Conflict(new { error = result.Error });
            return BadRequest(new { error = result.Error });
        }
        return Ok(result.Value);
    }

    [HttpPost("claim")]
    [Authorize]
    public async Task<ActionResult<AuthResult>> ClaimAnonymous([FromBody] AnonymousClaimRequest request, CancellationToken ct)
    {
        if (currentUser.UserId is not Guid userId) return Unauthorized();
        if (!currentUser.IsAnonymous) return BadRequest(new { error = "Ο χρήστης είναι ήδη εγγεγραμμένος." });

        var result = await authService.ClaimAnonymousAsync(userId, request, ct);
        if (result.IsFailure)
        {
            if (result.Error.StartsWith("Υπάρχει ήδη"))
                return Conflict(new { error = result.Error });
            return BadRequest(new { error = result.Error });
        }
        return Ok(result.Value);
    }

    [HttpPost("login")]
    [AllowAnonymous]
    public async Task<ActionResult<AuthResult>> Login([FromBody] LoginRequest request, CancellationToken ct)
    {
        var result = await authService.LoginAsync(request, ct);
        if (result.IsFailure) return Unauthorized(new { error = result.Error });
        return Ok(result.Value);
    }

    [HttpPost("refresh")]
    [AllowAnonymous]
    public async Task<ActionResult<RefreshResult>> Refresh([FromBody] RefreshRequest request, CancellationToken ct)
    {
        var result = await authService.RefreshAsync(request, ct);
        if (result.IsFailure) return Unauthorized(new { error = result.Error });
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
        if (result.IsFailure) return BadRequest(new { error = result.Error });
        return Ok(new { message = "Ο κωδικός άλλαξε επιτυχώς." });
    }
}
