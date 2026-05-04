using Domain.Common;

namespace Domain.Entities;

public class RefreshToken : BaseEntity
{
    public Guid UserId { get; private set; }
    public string TokenHash { get; private set; } = string.Empty;
    public DateTime ExpiresAt { get; private set; }
    public DateTime? RevokedAt { get; private set; }

    public bool IsActive => RevokedAt is null && DateTime.UtcNow < ExpiresAt;

    private RefreshToken() { }

    public static RefreshToken Create(Guid userId, string tokenHash, DateTime expiresAt)
    {
        return new RefreshToken
        {
            UserId = userId,
            TokenHash = tokenHash,
            ExpiresAt = expiresAt,
        };
    }

    public void Revoke()
    {
        if (RevokedAt is not null) return;
        RevokedAt = DateTime.UtcNow;
        SetUpdated();
    }
}
