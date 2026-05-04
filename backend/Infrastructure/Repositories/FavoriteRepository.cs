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
        var query = _dbSet.Where(f => f.UserId == userId && f.DeletedAt == null);
        if (since.HasValue)
        {
            var cutoff = since.Value;
            query = query.Where(f =>
                (f.UpdatedAt != null && f.UpdatedAt > cutoff) ||
                (f.UpdatedAt == null && f.CreatedAt > cutoff));
        }
        return await query.ToListAsync(ct);
    }

    public async Task<List<Guid>> GetTombstoneIdsSinceAsync(Guid userId, DateTime? since, CancellationToken ct = default)
    {
        var query = _dbSet.Where(f => f.UserId == userId && f.DeletedAt != null);
        if (since.HasValue)
        {
            var cutoff = since.Value;
            query = query.Where(f => f.DeletedAt > cutoff);
        }
        return await query.Select(f => f.Id).ToListAsync(ct);
    }
}
