using System.Collections.Concurrent;

namespace Infrastructure.Authentication;

// Per-email rate limiter for forgot-password requests.
// Prevents email-flooding attacks. In-memory; if we ever scale to multiple
// API instances we'll need to externalize this (Redis), but at v1 scale
// a single instance is fine. Self-prunes entries older than the rate window
// so an attacker cycling random emails can't grow this dictionary unbounded.
public class PasswordResetRateLimiter
{
    private static readonly TimeSpan MinInterval = TimeSpan.FromMinutes(1);
    private static readonly TimeSpan PruneInterval = TimeSpan.FromMinutes(5);
    private readonly ConcurrentDictionary<string, DateTime> _lastRequest = new();
    private DateTime _nextPruneAt = DateTime.UtcNow + PruneInterval;
    private readonly object _pruneLock = new();

    public bool TryRecord(string email)
    {
        var key = email.Trim().ToLowerInvariant();
        var now = DateTime.UtcNow;

        MaybePrune(now);

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

    private void MaybePrune(DateTime now)
    {
        if (now < _nextPruneAt) return;
        if (!Monitor.TryEnter(_pruneLock)) return;
        try
        {
            if (now < _nextPruneAt) return;
            var cutoff = now - MinInterval;
            foreach (var (key, ts) in _lastRequest)
            {
                if (ts < cutoff) _lastRequest.TryRemove(key, out _);
            }
            _nextPruneAt = now + PruneInterval;
        }
        finally
        {
            Monitor.Exit(_pruneLock);
        }
    }
}
