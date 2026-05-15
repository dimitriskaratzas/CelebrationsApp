using Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace Infrastructure.Persistence;

// Hard-deletes soft-deleted Favorites older than the offline-window guarantee.
// Mobile clients may go offline for weeks; tombstones must persist long enough that
// a returning client pulls them via ?since= and removes the matching local row.
// Anything older than RetentionDays is safe to garbage-collect.
public class TombstoneRetentionService(
    IServiceProvider services,
    ILogger<TombstoneRetentionService> logger) : BackgroundService
{
    private static readonly TimeSpan RunInterval = TimeSpan.FromHours(24);
    private const int RetentionDays = 180;

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        // Sleep first so app boot isn't slowed by the sweep.
        try { await Task.Delay(TimeSpan.FromMinutes(5), stoppingToken); }
        catch (TaskCanceledException) { return; }

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await SweepAsync(stoppingToken);
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Tombstone sweep failed; will retry next cycle");
            }

            try { await Task.Delay(RunInterval, stoppingToken); }
            catch (TaskCanceledException) { return; }
        }
    }

    private async Task SweepAsync(CancellationToken ct)
    {
        using var scope = services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        if (!db.Database.IsRelational()) return;   // tests / InMemory: no-op

        var cutoff = DateTime.UtcNow.AddDays(-RetentionDays);
        var deleted = await db.Favorites
            .Where(f => f.DeletedAt != null && f.DeletedAt < cutoff)
            .ExecuteDeleteAsync(ct);

        if (deleted > 0)
        {
            logger.LogInformation("Tombstone sweep removed {Count} rows older than {Cutoff:O}", deleted, cutoff);
        }
    }
}
