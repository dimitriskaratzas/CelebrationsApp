using Application.Common.Interfaces;
using Domain.Entities;
using Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Infrastructure.Repositories;

public class FavoriteRepository(AppDbContext context)
    : BaseRepository<Favorite>(context), IFavoriteRepository
{
    public Task<Favorite?> GetByIdForUserAsync(Guid id, Guid userId, CancellationToken ct = default)
        => _dbSet.FirstOrDefaultAsync(f => f.Id == id && f.UserId == userId, ct);

    public Task<Favorite?> GetLiveByIdForUserAsync(Guid id, Guid userId, CancellationToken ct = default)
        => _dbSet.FirstOrDefaultAsync(f => f.Id == id && f.UserId == userId && f.DeletedAt == null, ct);

    public Task<bool> ExistsAsync(Guid id, CancellationToken ct = default)
        => _dbSet.AnyAsync(f => f.Id == id, ct);

    public Task<bool> ExistsForOtherUserAsync(Guid id, Guid userId, CancellationToken ct = default)
        => _dbSet.AnyAsync(f => f.Id == id && f.UserId != userId, ct);

    public Task<int> CountLiveByUserAsync(Guid userId, CancellationToken ct = default)
        => _dbSet.CountAsync(f => f.UserId == userId && f.DeletedAt == null, ct);

    public async Task<List<Favorite>> GetLiveSinceAsync(Guid userId, DateTime? since, CancellationToken ct = default)
    {
        var query = BuildLiveSinceQuery(userId, since);
        return await query.ToListAsync(ct);
    }

    public async Task<(List<Favorite> Items, bool HasMore)> GetLivePageSinceAsync(
        Guid userId, DateTime? since, int pageSize, CancellationToken ct = default)
    {
        // Order by (UpdatedAt, Id) so the cursor is stable across rows with the same timestamp.
        // Fetch pageSize+1 to detect HasMore without a separate COUNT query.
        var page = await BuildLiveSinceQuery(userId, since)
            .OrderBy(f => f.UpdatedAt ?? f.CreatedAt).ThenBy(f => f.Id)
            .Take(pageSize + 1)
            .ToListAsync(ct);

        var hasMore = page.Count > pageSize;
        if (hasMore) page.RemoveAt(page.Count - 1);
        return (page, hasMore);
    }

    public async Task<List<Guid>> GetTombstoneIdsSinceAsync(Guid userId, DateTime? since, CancellationToken ct = default)
    {
        var query = _dbSet.Where(f => f.UserId == userId && f.DeletedAt != null);
        if (since.HasValue)
        {
            var cutoff = NormalizeUtc(since.Value);
            // Use >= so an edit landing exactly at the cursor timestamp isn't lost. Clients upsert
            // by id, so the worst case is one redundant row per sync.
            query = query.Where(f => f.DeletedAt >= cutoff);
        }
        return await query.Select(f => f.Id).ToListAsync(ct);
    }

    private IQueryable<Favorite> BuildLiveSinceQuery(Guid userId, DateTime? since)
    {
        var query = _dbSet.Where(f => f.UserId == userId && f.DeletedAt == null);
        if (since.HasValue)
        {
            var cutoff = NormalizeUtc(since.Value);
            // >= same reasoning as tombstones: clients upsert idempotently, the tiny duplication
            // cost is worth never losing an edit at exactly the cursor.
            query = query.Where(f =>
                (f.UpdatedAt != null && f.UpdatedAt >= cutoff) ||
                (f.UpdatedAt == null && f.CreatedAt >= cutoff));
        }
        return query;
    }

    private static DateTime NormalizeUtc(DateTime value) =>
        value.Kind == DateTimeKind.Utc ? value : DateTime.SpecifyKind(value.ToUniversalTime(), DateTimeKind.Utc);
}
