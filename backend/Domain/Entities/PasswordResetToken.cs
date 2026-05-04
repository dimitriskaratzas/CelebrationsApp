using Domain.Common;

namespace Domain.Entities;

public class PasswordResetToken : BaseEntity
{
    public Guid UserId { get; private set; }
    public string TokenHash { get; private set; } = string.Empty;
    public DateTime ExpiresAt { get; private set; }
    public DateTime? UsedAt { get; private set; }

    public bool IsActive => UsedAt is null && DateTime.UtcNow < ExpiresAt;

    private PasswordResetToken() { }

    public static PasswordResetToken Create(Guid userId, string tokenHash, DateTime expiresAt) =>
        new() { UserId = userId, TokenHash = tokenHash, ExpiresAt = expiresAt };

    public void MarkUsed()
    {
        if (UsedAt is not null) return;
        UsedAt = DateTime.UtcNow;
        SetUpdated();
    }
}
