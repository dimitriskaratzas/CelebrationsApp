using Domain.Entities;
using Domain.Interfaces;

namespace Application.Common.Interfaces;

public interface IFavoriteRepository : IRepository<Favorite>
{
    Task<Favorite?> GetByIdForUserAsync(Guid id, Guid userId, CancellationToken ct = default);

    Task<Favorite?> GetLiveByIdForUserAsync(Guid id, Guid userId, CancellationToken ct = default);

    Task<bool> ExistsAsync(Guid id, CancellationToken ct = default);

    Task<bool> ExistsForOtherUserAsync(Guid id, Guid userId, CancellationToken ct = default);

    Task<int> CountLiveByUserAsync(Guid userId, CancellationToken ct = default);

    Task<List<Favorite>> GetLiveSinceAsync(Guid userId, DateTime? since, CancellationToken ct = default);

    // Paginated variant for sync. Returns up to `pageSize` rows ordered by (UpdatedAt, Id) and a flag
    // signalling whether more rows beyond this page also match the cursor. Clients keep pulling with
    // the latest UpdatedAt as their new ?since= until HasMore is false.
    Task<(List<Favorite> Items, bool HasMore)> GetLivePageSinceAsync(
        Guid userId, DateTime? since, int pageSize, CancellationToken ct = default);

    Task<List<Guid>> GetTombstoneIdsSinceAsync(Guid userId, DateTime? since, CancellationToken ct = default);
}
