using System.Text.Json;
using Application.Common;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;

namespace Api.Middleware;

public class GlobalExceptionMiddleware(RequestDelegate next, ILogger<GlobalExceptionMiddleware> logger)
{
    public async Task InvokeAsync(HttpContext context)
    {
        try
        {
            await next(context);
        }
        catch (OperationCanceledException) when (context.RequestAborted.IsCancellationRequested)
        {
            // Client disconnected mid-request; not a server error and the socket is gone.
        }
        catch (Exception ex)
        {
            var traceId = context.TraceIdentifier;
            logger.LogError(ex, "Unhandled exception {TraceId} for {Method} {Path}", traceId, context.Request.Method, context.Request.Path);

            if (context.Response.HasStarted) throw;

            context.Response.Clear();
            context.Response.ContentType = "application/problem+json";
            context.Response.StatusCode = StatusCodes.Status500InternalServerError;

            var problem = new ProblemDetails
            {
                Status = StatusCodes.Status500InternalServerError,
                Title = "Παρουσιάστηκε σφάλμα.",
                Type = "about:blank#INTERNAL_ERROR",
            };
            problem.Extensions["code"] = "INTERNAL_ERROR";
            problem.Extensions["traceId"] = traceId;

            await JsonSerializer.SerializeAsync(context.Response.Body, problem);
        }
    }
}
