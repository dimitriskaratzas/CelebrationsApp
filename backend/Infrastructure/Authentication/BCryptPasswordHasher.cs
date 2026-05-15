using Application.Common.Interfaces;
using Microsoft.Extensions.Logging;

namespace Infrastructure.Authentication;

public class BCryptPasswordHasher(ILogger<BCryptPasswordHasher>? logger = null) : IPasswordHasher
{
    private const int WorkFactor = 12;

    public string Hash(string password) =>
        BCrypt.Net.BCrypt.HashPassword(password, WorkFactor);

    public bool Verify(string password, string hash)
    {
        if (string.IsNullOrEmpty(hash)) return false;

        try
        {
            return BCrypt.Net.BCrypt.Verify(password, hash);
        }
        catch (BCrypt.Net.SaltParseException ex)
        {
            // Stored hash isn't a valid BCrypt salt — corrupt or hand-edited.
            logger?.LogWarning(ex, "BCrypt salt parse failed; treating as invalid credentials");
            return false;
        }
        catch (Exception ex)
        {
            // Defensive: any malformed-hash code path (truncated, wrong version prefix) should
            // surface as failed login, not a 500. Log loudly so ops can spot DB corruption.
            logger?.LogError(ex, "Unexpected BCrypt verification failure; treating as invalid credentials");
            return false;
        }
    }
}
