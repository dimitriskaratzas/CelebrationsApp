using System.Collections.Concurrent;

namespace Infrastructure.Authentication;

// Per-email rate limiter for forgot-password requests.
// Prevents email-flooding attacks. In-memory; if we ever scale to multiple
// API instances we'll need to externalize this (Redis), but at v1 scale
// a single instance is fine.
public class PasswordResetRateLimiter
{
    private static readonly TimeSpan MinInterval = TimeSpan.FromMinutes(1);
    private readonly ConcurrentDictionary<string, DateTime> _lastRequest = new();

    public bool TryRecord(string email)
    {
        var key = email.Trim().ToLowerInvariant();
        var now = DateTime.UtcNow;

        var allowed = true;
        _lastRequest.AddOrUpdate(key,
            addValueFactory: _ => now,
            updateValueFactory: (_, last) =>
            {
                if (now - last < MinInterval)
                {
                    allowed = false;
                    return last;
                }
                return now;
            });

        return allowed;
    }
}
