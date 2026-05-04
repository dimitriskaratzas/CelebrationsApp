using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using Application.Common.Interfaces;
using Microsoft.AspNetCore.Http;

namespace Infrastructure.Authentication;

public class CurrentUserService(IHttpContextAccessor httpContextAccessor) : ICurrentUser
{
    private ClaimsPrincipal? Principal => httpContextAccessor.HttpContext?.User;

    public Guid? UserId
    {
        get
        {
            var value = Principal?.FindFirst(JwtRegisteredClaimNames.Sub)?.Value
                     ?? Principal?.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            return Guid.TryParse(value, out var id) ? id : null;
        }
    }

    public string? Email =>
        Principal?.FindFirst(JwtRegisteredClaimNames.Email)?.Value
        ?? Principal?.FindFirst(ClaimTypes.Email)?.Value;

    public bool IsAuthenticated => Principal?.Identity?.IsAuthenticated ?? false;

    public bool IsAnonymous =>
        Principal?.FindFirst("anonymous")?.Value == "true";
}
