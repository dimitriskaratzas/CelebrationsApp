using Application.Common.Interfaces;
using Domain.Entities;
using Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Infrastructure.Repositories;

public class RefreshTokenRepository(AppDbContext context) : BaseRepository<RefreshToken>(context), IRefreshTokenRepository
{
    public async Task<RefreshToken?> GetByTokenHashAsync(string tokenHash, CancellationToken ct = default)
        => await _dbSet.FirstOrDefaultAsync(t => t.TokenHash == tokenHash, ct);

    public async Task RevokeAllForUserAsync(Guid userId, CancellationToken ct = default)
    {
        var now = DateTime.UtcNow;
        if (_context.Database.IsRelational())
        {
            // Single UPDATE — avoids loading every refresh token a user has ever had into memory.
            await _dbSet
                .Where(t => t.UserId == userId && t.RevokedAt == null)
                .ExecuteUpdateAsync(s => s.SetProperty(t => t.RevokedAt, now), ct);
            return;
        }

        // InMemory fallback (tests only).
        var tokens = await _dbSet
            .Where(t => t.UserId == userId && t.RevokedAt == null)
            .ToListAsync(ct);
        foreach (var t in tokens) t.Revoke();
        await _context.SaveChangesAsync(ct);
    }
}
