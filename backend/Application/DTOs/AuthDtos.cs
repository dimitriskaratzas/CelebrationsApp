namespace Application.DTOs;

public record RegisterRequest(string Email, string Password);

public record LoginRequest(string Email, string Password);

public record RefreshRequest(string RefreshToken);

public record LogoutRequest(string RefreshToken);

public record ForgotPasswordRequest(string Email);

public record ResetPasswordRequest(string Token, string NewPassword);

public record AnonymousClaimRequest(string Email, string Password);

public record AuthResult(
    string AccessToken,
    string RefreshToken,
    DateTime AccessTokenExpiresAt,
    UserDto User);

public record RefreshResult(
    string AccessToken,
    string RefreshToken,
    DateTime AccessTokenExpiresAt);
