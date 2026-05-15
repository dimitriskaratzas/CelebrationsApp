namespace Application.Common;

// Machine-readable error codes returned in API responses. Mobile clients should
// branch on these rather than on HTTP status alone or on the Greek error text.
public static class ErrorCodes
{
    public const string EmailTaken = "EMAIL_TAKEN";
    public const string InvalidCredentials = "INVALID_CREDENTIALS";
    public const string UserAlreadyRegistered = "USER_ALREADY_REGISTERED";
    public const string UserNotFound = "USER_NOT_FOUND";
    public const string InvalidResetToken = "INVALID_RESET_TOKEN";
    public const string InvalidRefreshToken = "INVALID_REFRESH_TOKEN";
    public const string RefreshTokenReused = "REFRESH_TOKEN_REUSED";
    public const string FreeTierCap = "FREE_TIER_CAP";
    public const string DuplicateFavoriteId = "DUPLICATE_FAVORITE_ID";
    public const string Validation = "VALIDATION";
}
