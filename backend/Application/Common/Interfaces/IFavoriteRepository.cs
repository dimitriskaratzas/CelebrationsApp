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

    Task<List<Guid>> GetTombstoneIdsSinceAsync(Guid userId, DateTime? since, CancellationToken ct = default);
}
