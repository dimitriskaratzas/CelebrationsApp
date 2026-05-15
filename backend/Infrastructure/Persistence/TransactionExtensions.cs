using System.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Storage;

namespace Infrastructure.Persistence;

// Transaction helpers that no-op on non-relational providers (e.g. the InMemory
// provider used by unit tests, which throws on BeginTransactionAsync). Production
// always runs Postgres so the transaction is always real.
public static class TransactionExtensions
{
    public static async Task<IDbContextTransaction?> BeginTransactionIfRelationalAsync(
        this DatabaseFacade db, IsolationLevel level, CancellationToken ct)
    {
        if (!db.IsRelational()) return null;
        return await db.BeginTransactionAsync(level, ct);
    }

    public static Task<IDbContextTransaction?> BeginTransactionIfRelationalAsync(
        this DatabaseFacade db, CancellationToken ct)
        => BeginTransactionIfRelationalAsync(db, IsolationLevel.ReadCommitted, ct);

    public static Task CommitIfPresentAsync(this IDbContextTransaction? tx, CancellationToken ct)
        => tx is null ? Task.CompletedTask : tx.CommitAsync(ct);

    public static Task RollbackIfPresentAsync(this IDbContextTransaction? tx, CancellationToken ct)
        => tx is null ? Task.CompletedTask : tx.RollbackAsync(ct);

    public static ValueTask DisposeIfPresentAsync(this IDbContextTransaction? tx)
        => tx is null ? ValueTask.CompletedTask : tx.DisposeAsync();
}
