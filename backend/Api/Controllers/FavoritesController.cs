using System.Data;
using Application.Common;
using Application.Common.Interfaces;
using Application.DTOs;
using Application.Mapping;
using Domain.Entities;
using Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;
using Microsoft.Extensions.Configuration;
using Npgsql;

namespace Api.Controllers;

[ApiController]
[Route("api/favorites")]
[Authorize]
public class FavoritesController(
    IFavoriteRepository favorites,
    IEntitlementRepository entitlements,
    ICurrentUser currentUser,
    AppDbContext dbContext,
    IConfiguration config) : ControllerBase
{
    private const int DefaultPageSize = 500;
    private const int MaxPageSize = 1000;
    private const string UniqueViolationSqlState = "23505";

    [HttpGet]
    public async Task<ActionResult<FavoritesSyncResponse>> GetAll(
        [FromQuery] DateTime? since,
        [FromQuery] int? limit,
        CancellationToken ct)
    {
        if (currentUser.UserId is not Guid userId) return Unauthorized();

        // Normalize the wire-format cursor to UTC. A client sending a bare "2026-05-15T10:00:00"
        // (no offset) parses as Kind=Unspecified; assume UTC. Clients sending "...Z" or an offset
        // already give us Kind=Utc / a known offset.
        DateTime? sinceUtc = since.HasValue
            ? DateTime.SpecifyKind(since.Value.ToUniversalTime(), DateTimeKind.Utc)
            : null;

        var pageSize = NormalizePageSize(limit);

        // Capture syncedAt BEFORE the queries so a row written between query and response
        // doesn't get its updatedAt lost on the next sync (the next ?since= will be <= this value).
        var syncedAt = DateTime.UtcNow;

        var (live, hasMore) = await favorites.GetLivePageSinceAsync(userId, sinceUtc, pageSize, ct);
        var deletions = await favorites.GetTombstoneIdsSinceAsync(userId, sinceUtc, ct);

        var dtos = live.Select(f => f.ToDto()).ToList();
        return Ok(new FavoritesSyncResponse(dtos, deletions, syncedAt, hasMore));
    }

    [HttpPost]
    public async Task<ActionResult<FavoriteDto>> Create(
        [FromBody] CreateFavoriteRequest request,
        CancellationToken ct)
    {
        if (currentUser.UserId is not Guid userId) return Unauthorized();

        // Idempotency fast path: same (userId, id) — return the existing row without re-inserting.
        var existing = await favorites.GetByIdForUserAsync(request.Id, userId, ct);
        if (existing is not null) return Ok(existing.ToDto());

        // Cross-user fast path: a different user already holds this UUID.
        // (Race-safe fallback for relational DBs is the 23505 catch below.)
        if (await favorites.ExistsForOtherUserAsync(request.Id, userId, ct))
        {
            return ProblemDetailsError(StatusCodes.Status409Conflict,
                ErrorCodes.DuplicateFavoriteId, "Το αναγνωριστικό υπάρχει ήδη.");
        }

        var creation = Favorite.Create(
            request.Id, userId,
            request.DisplayName, request.NameDayKey,
            request.BirthdayDate, request.Relationship);
        if (creation.IsFailure)
            return ProblemDetailsError(StatusCodes.Status400BadRequest, ErrorCodes.Validation, creation.Error);

        // Serializable transaction: the cap count + insert must be atomic with respect to other
        // concurrent inserts for the same user. The cost (a single user can't insert two favorites
        // truly simultaneously) is acceptable.
        await using IDbContextTransaction? tx =
            await dbContext.Database.BeginTransactionIfRelationalAsync(IsolationLevel.Serializable, ct);
        try
        {
            // Cap check (skipped for premium users).
            if (!await entitlements.IsPremiumAsync(userId, ct))
            {
                var cap = config.GetValue<int>("Premium:FreeFavoritesCap");
                var count = await favorites.CountLiveByUserAsync(userId, ct);
                if (count >= cap)
                {
                    await tx.RollbackIfPresentAsync(ct);
                    var message = $"Έχεις φτάσει το όριο των {cap} αγαπημένων στη δωρεάν έκδοση.";
                    var details = new ProblemDetails
                    {
                        Status = StatusCodes.Status403Forbidden,
                        Title = message,
                        Type = $"about:blank#{ErrorCodes.FreeTierCap}",
                    };
                    details.Extensions["code"] = ErrorCodes.FreeTierCap;
                    details.Extensions["limit"] = cap;
                    return StatusCode(StatusCodes.Status403Forbidden, details);
                }
            }

            await favorites.AddAsync(creation.Value!, ct);
            await favorites.SaveChangesAsync(ct);
            await tx.CommitIfPresentAsync(ct);
        }
        catch (DbUpdateException ex) when (IsUniqueViolation(ex))
        {
            await tx.RollbackIfPresentAsync(ct);
            // PK collision: either it's our own user (race we just missed in the fast-path read)
            // or it's another user holding this UUID.
            var ours = await favorites.GetByIdForUserAsync(request.Id, userId, ct);
            if (ours is not null) return Ok(ours.ToDto());

            return ProblemDetailsError(StatusCodes.Status409Conflict,
                ErrorCodes.DuplicateFavoriteId, "Το αναγνωριστικό υπάρχει ήδη.");
        }

        return CreatedAtAction(nameof(GetAll), new { id = creation.Value!.Id }, creation.Value.ToDto());
    }

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<FavoriteDto>> Update(
        Guid id,
        [FromBody] UpdateFavoriteRequest request,
        CancellationToken ct)
    {
        if (currentUser.UserId is not Guid userId) return Unauthorized();

        var favorite = await favorites.GetLiveByIdForUserAsync(id, userId, ct);
        if (favorite is null) return NotFound(new { error = "Δεν βρέθηκε." });

        var update = favorite.Update(
            request.DisplayName, request.NameDayKey,
            request.BirthdayDate, request.Relationship);
        if (update.IsFailure)
            return ProblemDetailsError(StatusCodes.Status400BadRequest, ErrorCodes.Validation, update.Error);

        favorites.Update(favorite);
        await favorites.SaveChangesAsync(ct);

        return Ok(favorite.ToDto());
    }

    [HttpDelete("{id:guid}")]
    public async Task<ActionResult> Delete(Guid id, CancellationToken ct)
    {
        if (currentUser.UserId is not Guid userId) return Unauthorized();

        var favorite = await favorites.GetLiveByIdForUserAsync(id, userId, ct);
        if (favorite is null) return NotFound(new { error = "Δεν βρέθηκε." });

        favorite.SoftDelete();
        favorites.Update(favorite);
        await favorites.SaveChangesAsync(ct);

        return NoContent();
    }

    private static int NormalizePageSize(int? limit)
    {
        if (!limit.HasValue || limit.Value <= 0) return DefaultPageSize;
        return Math.Min(limit.Value, MaxPageSize);
    }

    private static bool IsUniqueViolation(DbUpdateException ex) =>
        ex.InnerException is PostgresException pg && pg.SqlState == UniqueViolationSqlState;

    private ObjectResult ProblemDetailsError(int status, string code, string message)
    {
        var details = new ProblemDetails
        {
            Status = status,
            Title = message,
            Type = $"about:blank#{code}",
        };
        details.Extensions["code"] = code;
        return StatusCode(status, details);
    }
}
