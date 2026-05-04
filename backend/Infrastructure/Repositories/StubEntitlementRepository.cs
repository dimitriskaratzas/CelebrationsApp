using Application.Common.Interfaces;
using Microsoft.Extensions.Logging;

namespace Infrastructure.Repositories;

public sealed class StubEntitlementRepository(ILogger<StubEntitlementRepository> logger)
    : IEntitlementRepository
{
    public Task<bool> IsPremiumAsync(Guid userId, CancellationToken ct = default)
    {
        logger.LogDebug("[STUB ENTITLEMENT] Premium check for {UserId} → false", userId);
        return Task.FromResult(false);
    }
}
