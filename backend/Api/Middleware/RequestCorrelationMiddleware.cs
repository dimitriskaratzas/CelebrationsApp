using Microsoft.AspNetCore.Http;

namespace Api.Middleware;

// Echoes (or assigns) an X-Request-Id header per request, and sets HttpContext.TraceIdentifier
// to the same value so middleware/log scopes downstream can correlate by it.
//
// Client-supplied IDs are accepted only if they fit a tight allowlist (alphanum + `-` `_`,
// up to 128 chars) so an attacker can't smuggle a megabyte trace id into our log pipeline.
public class RequestCorrelationMiddleware(RequestDelegate next)
{
    private const string HeaderName = "X-Request-Id";
    private const int MaxLength = 128;

    public async Task InvokeAsync(HttpContext context)
    {
        string requestId;
        if (context.Request.Headers.TryGetValue(HeaderName, out var incoming)
            && incoming.Count == 1
            && IsSafeId(incoming[0]))
        {
            requestId = incoming[0]!;
        }
        else
        {
            requestId = Guid.NewGuid().ToString("N");
        }

        context.TraceIdentifier = requestId;
        context.Response.Headers[HeaderName] = requestId;

        await next(context);
    }

    private static bool IsSafeId(string? value)
    {
        if (string.IsNullOrWhiteSpace(value)) return false;
        if (value.Length > MaxLength) return false;
        foreach (var c in value)
        {
            if (!(char.IsAsciiLetterOrDigit(c) || c == '-' || c == '_')) return false;
        }
        return true;
    }
}
