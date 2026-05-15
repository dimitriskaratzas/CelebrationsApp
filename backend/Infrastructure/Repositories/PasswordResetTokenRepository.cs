using Application.Common.Interfaces;
using Domain.Entities;
using Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Infrastructure.Repositories;

public class PasswordResetTokenRepository(AppDbContext context) : BaseRepository<PasswordResetToken>(context), IPasswordResetTokenRepository
{
    public async Task<PasswordResetToken?> GetByTokenHashAsync(string tokenHash, CancellationToken ct = default)
        => await _dbSet.FirstOrDefaultAsync(t => t.TokenHash == tokenHash, ct);

    public async Task RevokeAllForUserAsync(Guid userId, CancellationToken ct = default)
    {
        var now = DateTime.UtcNow;
        if (_context.Database.IsRelational())
        {
            await _dbSet
                .Where(t => t.UserId == userId && t.UsedAt == null)
                .ExecuteUpdateAsync(s => s.SetProperty(t => t.UsedAt, now), ct);
            return;
        }

        // InMemory fallback (tests only).
        var tokens = await _dbSet
            .Where(t => t.UserId == userId && t.UsedAt == null)
            .ToListAsync(ct);
        foreach (var t in tokens) t.MarkUsed();
        await _context.SaveChangesAsync(ct);
    }
}
