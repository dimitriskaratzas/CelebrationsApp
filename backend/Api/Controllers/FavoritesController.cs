using Application.Common.Interfaces;
using Application.DTOs;
using Application.Mapping;
using Domain.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Configuration;

namespace Api.Controllers;

[ApiController]
[Route("api/favorites")]
[Authorize]
public class FavoritesController(
    IFavoriteRepository favorites,
    IEntitlementRepository entitlements,
    ICurrentUser currentUser,
    IConfiguration config) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<FavoritesSyncResponse>> GetAll(
        [FromQuery] DateTime? since,
        CancellationToken ct)
    {
        if (currentUser.UserId is not Guid userId) return Unauthorized();

        var syncedAt = DateTime.UtcNow;
        var live = await favorites.GetLiveSinceAsync(userId, since, ct);
        var deletions = await favorites.GetTombstoneIdsSinceAsync(userId, since, ct);

        var dtos = live.Select(f => f.ToDto()).ToList();
        return Ok(new FavoritesSyncResponse(dtos, deletions, syncedAt));
    }

    [HttpPost]
    public async Task<ActionResult<FavoriteDto>> Create(
        [FromBody] CreateFavoriteRequest request,
        CancellationToken ct)
    {
        if (currentUser.UserId is not Guid userId) return Unauthorized();

        // Idempotency: same (userId, id) returns the existing record.
        var existing = await favorites.GetByIdForUserAsync(request.Id, userId, ct);
        if (existing is not null) return Ok(existing.ToDto());

        // Cross-user UUID collision.
        if (await favorites.ExistsForOtherUserAsync(request.Id, userId, ct))
            return Conflict(new { error = "Το αναγνωριστικό υπάρχει ήδη." });

        // Cap check (skipped for premium users).
        if (!await entitlements.IsPremiumAsync(userId, ct))
        {
            var cap = config.GetValue<int>("Premium:FreeFavoritesCap");
            var count = await favorites.CountLiveByUserAsync(userId, ct);
            if (count >= cap)
            {
                return StatusCode(402, new
                {
                    error = $"Έχεις φτάσει το όριο των {cap} αγαπημένων στη δωρεάν έκδοση."
                });
            }
        }

        var creation = Favorite.Create(
            request.Id, userId,
            request.DisplayName, request.NameDayKey,
            request.BirthdayDate, request.Relationship);
        if (creation.IsFailure) return BadRequest(new { error = creation.Error });

        await favorites.AddAsync(creation.Value!, ct);
        await favorites.SaveChangesAsync(ct);

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
        if (update.IsFailure) return BadRequest(new { error = update.Error });

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
}
