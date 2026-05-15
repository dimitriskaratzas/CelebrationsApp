using System.Text;
using Api.Middleware;
using Infrastructure;
using Infrastructure.Authentication;
using Infrastructure.Persistence;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.HttpLogging;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;

// DateTime contract for this service:
//   * All persisted timestamps are TIMESTAMPTZ in Postgres and DateTime with Kind=Utc in C#.
//   * Npgsql 6+ refuses non-UTC DateTime values for TIMESTAMPTZ columns when the legacy switch is OFF;
//     keep it off so any future code that constructs Kind=Local/Unspecified fails loudly instead of
//     silently misinterpreting a local time as UTC.
//   * Incoming DateTimes from the wire (e.g. ?since= cursor) are normalized to UTC at the controller
//     boundary — see FavoritesController.GetAll.

var builder = WebApplication.CreateBuilder(args);

// Services
builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();
builder.Services.AddInfrastructure(builder.Configuration);

// Lightweight HTTP request logging (method, path, status, duration). Correlation id added by
// RequestCorrelationMiddleware below.
builder.Services.AddHttpLogging(o =>
{
    o.LoggingFields = HttpLoggingFields.RequestMethod | HttpLoggingFields.RequestPath
                    | HttpLoggingFields.ResponseStatusCode | HttpLoggingFields.Duration;
});

// JWT Bearer auth
var jwt = builder.Configuration.GetSection(JwtSettings.SectionName).Get<JwtSettings>()
          ?? throw new InvalidOperationException("Jwt section missing from configuration.");
if (string.IsNullOrWhiteSpace(jwt.Key) || jwt.Key.Length < 32)
    throw new InvalidOperationException("Jwt:Key must be configured and at least 32 characters long.");

builder.Services
    .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = jwt.Issuer,
            ValidAudience = jwt.Audience,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwt.Key)),
            ClockSkew = TimeSpan.FromSeconds(30),
        };
    });

builder.Services.AddAuthorization(options =>
{
    // FallbackPolicy means any endpoint without an explicit [AllowAnonymous] requires a valid
    // bearer token. Health/ready and the /api/auth/* endpoints opt in to [AllowAnonymous] below.
    options.FallbackPolicy = new AuthorizationPolicyBuilder()
        .RequireAuthenticatedUser()
        .Build();
});

// CORS intentionally omitted: the only consumer is the React Native app, which doesn't perform
// CORS preflight. If/when a web admin surface is added, configure named policies here per-origin
// — never AllowAnyOrigin in production.

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseMiddleware<RequestCorrelationMiddleware>();
app.UseMiddleware<GlobalExceptionMiddleware>();
app.UseHttpLogging();

if (!app.Environment.IsDevelopment())
{
    app.UseHttpsRedirection();
}

app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();

// Liveness probe — cheap, no DB. Use this for load balancer / container orchestrator probes.
app.MapGet("/api/health", [AllowAnonymous] () => Results.Ok(new { status = "ok" }));

// Readiness probe — also touches the DB so external probes can stop sending traffic when the
// pool is unreachable (e.g. Supabase rotating IPs, network hiccup after a cold start).
// Note: `[AllowAnonymous]` is applied as an attribute on the delegate (not `.AllowAnonymous()`
// chained on the builder) because the latter doesn't reliably opt out of `FallbackPolicy =
// RequireAuthenticatedUser` for async delegates with DI parameters in .NET 10.
app.MapGet("/api/ready", [AllowAnonymous] async (
    [FromServices] AppDbContext db,
    CancellationToken ct) =>
{
    var ok = await db.Database.CanConnectAsync(ct);
    return ok
        ? Results.Ok(new { status = "ready" })
        : Results.Json(new { status = "not_ready" }, statusCode: StatusCodes.Status503ServiceUnavailable);
});

app.Run();

// Visible to WebApplicationFactory in integration tests; expression-bodied for ergonomics.
public partial class Program;
