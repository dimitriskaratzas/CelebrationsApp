using Domain.Entities;

namespace Application.Common.Interfaces;

public interface IJwtTokenService
{
    // Issues a signed JWT for the given user. Anonymous users are permitted —
    // the token includes their UserId and a flag indicating anonymous status.
    (string Token, DateTime ExpiresAt) Issue(User user);
}
