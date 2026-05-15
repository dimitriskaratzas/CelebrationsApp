using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Application.Common.Interfaces;
using Domain.Entities;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;

namespace Infrastructure.Authentication;

public class JwtTokenService(IOptions<JwtSettings> options) : IJwtTokenService
{
    private readonly JwtSettings _settings = options.Value;

    // NOTE on access-token revocation: jti is included for future denylist support but is NOT
    // persisted. With a 15-minute access token lifetime the design choice is "wait it out" —
    // the refresh-token revocation path is the real lever for ending a session. If we need
    // immediate access-token revocation later, persist Jti to a small (jti, exp) table and check
    // it in a JwtBearerEvents.OnTokenValidated handler.
    public (string Token, DateTime ExpiresAt) Issue(User user)
    {
        var expiresAt = DateTime.UtcNow.AddMinutes(_settings.AccessTokenMinutes);

        var claims = new List<Claim>
        {
            new(JwtRegisteredClaimNames.Sub, user.Id.ToString()),
            new(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString()),
            // String value preserved for backwards compatibility with tokens already in the wild;
            // see ICurrentUser.IsAnonymous for the read side. Plan 4 can switch to a typed claim.
            new("anonymous", user.IsAnonymous ? "true" : "false"),
        };

        if (user.Email is not null)
            claims.Add(new Claim(JwtRegisteredClaimNames.Email, user.Email.Value));

        var keyBytes = Encoding.UTF8.GetBytes(_settings.Key);
        var creds = new SigningCredentials(new SymmetricSecurityKey(keyBytes), SecurityAlgorithms.HmacSha256);

        var token = new JwtSecurityToken(
            issuer: _settings.Issuer,
            audience: _settings.Audience,
            claims: claims,
            notBefore: DateTime.UtcNow,
            expires: expiresAt,
            signingCredentials: creds);

        return (new JwtSecurityTokenHandler().WriteToken(token), expiresAt);
    }
}
