namespace Application.Common.Interfaces;

public interface IEntitlementRepository
{
    Task<bool> IsPremiumAsync(Guid userId, CancellationToken ct = default);
}
