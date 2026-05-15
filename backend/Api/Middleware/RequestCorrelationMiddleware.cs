using Microsoft.AspNetCore.Http;

namespace Api.Middleware;

// Echoes (or assigns) an X-Request-Id header per request, and sets HttpContext.TraceIdentifier
// to the same value so middleware/log scopes downstream can correlate by it.
public class RequestCorrelationMiddleware(RequestDelegate next)
{
    private const string HeaderName = "X-Request-Id";

    public async Task InvokeAsync(HttpContext context)
    {
        var requestId =
            context.Request.Headers.TryGetValue(HeaderName, out var incoming) && !string.IsNullOrWhiteSpace(incoming.ToString())
                ? incoming.ToString()
                : Guid.NewGuid().ToString("N");

        context.TraceIdentifier = requestId;
        context.Response.Headers[HeaderName] = requestId;

        await next(context);
    }
}
